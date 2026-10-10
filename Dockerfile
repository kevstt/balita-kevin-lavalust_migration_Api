ARG PHP_VERSION=8.5

FROM php:${PHP_VERSION}-apache

ENV APP_ENV=production

# Install PDO MySQL and enable LavaLust's Apache rewrite rules.
RUN docker-php-ext-install pdo pdo_mysql \
    && a2enmod rewrite

# Allow the project's .htaccess files to route requests through public/index.php.
RUN sed -i '/<Directory \/var\/www\/>/,/<\/Directory>/ s/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf

# Copy only the API application; the React client is deployed separately.
COPY . /var/www/html/

RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html

ENV APACHE_DOCUMENT_ROOT=/var/www/html/public

RUN sed -i 's|DocumentRoot /var/www/html|DocumentRoot ${APACHE_DOCUMENT_ROOT}|g' /etc/apache2/sites-available/000-default.conf \
    && sed -i 's|<Directory /var/www/html>|<Directory ${APACHE_DOCUMENT_ROOT}>|g' /etc/apache2/apache2.conf

EXPOSE 80
