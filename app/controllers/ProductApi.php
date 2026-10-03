<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class ProductApi extends Controller
{
    public function __construct()
    {
        parent::__construct();
        header('Content-Type: application/json; charset=utf-8');
        $this->call->library('api');
        try {
            $this->call->database();
        } catch (Throwable $error) {
            error_log('Product API database connection failed: ' . $error->getMessage());
            $this->api->respond_error('Database connection unavailable. Check the database settings and Aiven CA certificate.', 503);
        }
    }

    public function register()
    {
        $this->api->rate_limit(null, 10, 60);
        $input = $this->request_body();
        $username = trim($input['username'] ?? '');
        $email = strtolower(trim($input['email'] ?? ''));
        $password = $input['password'] ?? '';

        if ($username === '' || strlen($username) > 100 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->api->respond_error('Enter a username and valid email address.', 422);
        }

        if (strlen($password) < 8) {
            $this->api->respond_error('Password must be at least 8 characters.', 422);
        }

        $existing = $this->db->raw(
            'SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1',
            [$username, $email]
        )->fetch(PDO::FETCH_ASSOC);

        if ($existing) {
            $this->api->respond_error('That username or email is already registered.', 409);
        }

        $this->db->raw(
            'INSERT INTO users (username, email, password, role, is_active) VALUES (?, ?, ?, ?, 1)',
            [$username, $email, password_hash($password, PASSWORD_DEFAULT), 'user']
        );

        $user = ['id' => $this->db->last_id(), 'username' => $username, 'email' => $email, 'role' => 'user'];
        $tokens = $this->api->issue_tokens(['id' => $user['id'], 'role' => $user['role']]);

        $this->api->respond(['message' => 'Account created.', 'user' => $user, 'tokens' => $tokens], 201);
    }

    public function login()
    {
        $this->api->rate_limit(null, 10, 60);
        $input = $this->request_body();
        $identity = trim($input['identity'] ?? $input['email'] ?? '');
        $password = $input['password'] ?? '';

        $user = $this->db->raw(
            'SELECT id, username, email, password, role FROM users WHERE (email = ? OR username = ?) AND is_active = 1 LIMIT 1',
            [$identity, $identity]
        )->fetch(PDO::FETCH_ASSOC);

        if (!$user || !password_verify($password, $user['password'])) {
            $this->api->respond_error('Email/username or password is incorrect.', 401);
        }

        $tokens = $this->api->issue_tokens(['id' => $user['id'], 'role' => $user['role']]);
        unset($user['password']);

        $this->api->respond(['message' => 'Signed in.', 'user' => $user, 'tokens' => $tokens]);
    }

    public function logout()
    {
        $this->api->require_jwt();
        $input = $this->request_body();

        if (!empty($input['refresh_token'])) {
            $this->api->revoke_refresh_token($input['refresh_token']);
        }

        $this->api->respond(['message' => 'Signed out.']);
    }

    public function refresh()
    {
        $input = $this->request_body();
        if (empty($input['refresh_token'])) {
            $this->api->respond_error('Refresh token is required.', 422);
        }

        $this->api->refresh_access_token($input['refresh_token']);
    }

    public function index()
    {
        $this->api->require_jwt();
        $products = $this->db->raw(
            'SELECT id, product_name, description, price, quantity, created_at FROM products ORDER BY created_at DESC, id DESC'
        )->fetchAll(PDO::FETCH_ASSOC);

        $this->api->respond(['data' => $products]);
    }

    public function create()
    {
        $this->api->require_jwt();
        $product = $this->validated_product($this->request_body());

        $this->db->raw(
            'INSERT INTO products (product_name, description, price, quantity) VALUES (?, ?, ?, ?)',
            [$product['product_name'], $product['description'], $product['price'], $product['quantity']]
        );

        $created = $this->find_product($this->db->last_id());
        $this->api->respond(['message' => 'Product created.', 'data' => $created], 201);
    }

    public function update($id)
    {
        $this->api->require_jwt();
        $current = $this->find_product($id);
        if (!$current) {
            $this->api->respond_error('Product not found.', 404);
        }

        $input = $this->request_body();
        $merged = array_merge($current, $input);
        $product = $this->validated_product($merged);

        $this->db->raw(
            'UPDATE products SET product_name = ?, description = ?, price = ?, quantity = ? WHERE id = ?',
            [$product['product_name'], $product['description'], $product['price'], $product['quantity'], (int) $id]
        );

        $this->api->respond(['message' => 'Product updated.', 'data' => $this->find_product($id)]);
    }

    public function delete($id)
    {
        $this->api->require_jwt();
        if (!$this->find_product($id)) {
            $this->api->respond_error('Product not found.', 404);
        }

        $this->db->raw('DELETE FROM products WHERE id = ?', [(int) $id]);
        $this->api->respond(['message' => 'Product deleted.']);
    }

    private function request_body()
    {
        $input = $this->api->body();
        array_walk_recursive($input, function (&$value) {
            if (is_string($value)) {
                $value = html_entity_decode($value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
            }
        });

        return $input;
    }

    private function validated_product($input)
    {
        $name = trim($input['product_name'] ?? '');
        $description = trim($input['description'] ?? '');
        $price = $input['price'] ?? null;
        $quantity = filter_var($input['quantity'] ?? null, FILTER_VALIDATE_INT);

        if ($name === '' || strlen($name) > 100) {
            $this->api->respond_error('Product name is required and must be 100 characters or fewer.', 422);
        }

        if (!is_numeric($price) || (float) $price < 0 || (float) $price >= 100000000) {
            $this->api->respond_error('Enter a valid non-negative price.', 422);
        }

        if ($quantity === false || $quantity < 0) {
            $this->api->respond_error('Quantity must be a non-negative whole number.', 422);
        }

        return [
            'product_name' => $name,
            'description' => $description,
            'price' => number_format((float) $price, 2, '.', ''),
            'quantity' => $quantity,
        ];
    }

    private function find_product($id)
    {
        return $this->db->raw(
            'SELECT id, product_name, description, price, quantity, created_at FROM products WHERE id = ? LIMIT 1',
            [(int) $id]
        )->fetch(PDO::FETCH_ASSOC);
    }
}