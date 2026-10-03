<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');
?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#10120f">
    <title>Balita Inventory</title>
    <style>
        :root {
            color-scheme: dark;
            font-family: "Segoe UI", Arial, sans-serif;
            background: #10120f;
            color: #f4f5ef;
        }

        * { box-sizing: border-box; }

        body {
            min-height: 100vh;
            margin: 0;
            display: grid;
            place-items: center;
            padding: 24px;
            background: radial-gradient(ellipse at top, #283326 0, #10120f 55%);
        }

        main {
            width: min(100%, 680px);
            padding: clamp(32px, 8vw, 64px);
            border: 1px solid #343a30;
            border-radius: 24px;
            background: rgba(22, 25, 21, .94);
            box-shadow: 0 24px 80px rgba(0, 0, 0, .35);
        }

        .eyebrow {
            color: #b6d79e;
            font-size: .78rem;
            font-weight: 700;
            letter-spacing: .14em;
            text-transform: uppercase;
        }

        h1 {
            margin: 18px 0;
            font-size: clamp(2.4rem, 8vw, 4.5rem);
            letter-spacing: -.06em;
            line-height: 1.02;
        }

        p {
            max-width: 480px;
            margin: 0;
            color: #bdc2b7;
            font-size: 1.08rem;
            line-height: 1.7;
        }

        a {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            margin-top: 32px;
            padding: 14px 20px;
            border-radius: 10px;
            background: #b6d79e;
            color: #152011;
            font-weight: 700;
            text-decoration: none;
            transition: background .2s, transform .2s;
        }

        a:hover {
            transform: translateY(-2px);
            background: #c9e7b3;
        }
    </style>
</head>
<body>
    <main>
        <div class="eyebrow">Balita · Product Management</div>
        <h1>Welcome to your inventory.</h1>
        <p>Keep your products organized, track stock, and manage your inventory from one simple workspace.</p>
        <a href="/product/">Open the product app <span aria-hidden="true">→</span></a>
    </main>
</body>
</html>
