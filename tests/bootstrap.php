<?php
error_reporting(-1);

if (!extension_loaded('xsl')) {
    echo "The XSL PHP extension must be enabled.\n";
    exit(1);
}
require_once dirname(__DIR__).'/vendor/autoload.php';
