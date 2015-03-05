<?php
namespace DoctrineXml;

use Exception;

/**
 * Verify doctrine-xml data.
 */
class Checker
{
    /**
     * Check if an xml code satisfy the schema.
     *
     * @param string $xml The xml code to verify
     * @param string $filename The name of the file from which the xml code has been read from
     *
     * @return string[]|null Return null of all is ok, a list of errors otherwise
     */
    public static function checkString($xml, $filename = '')
    {
        $doc = Utilities::stringToDOMDocument($xml, $filename);
        $errors = null;
        $preUseInternalErrors = libxml_use_internal_errors(true);
        try {
            if (!$doc->schemaValidateSource(static::getSchema())) {
                $errors = Utilities::explainLibXmlErrors($filename);
            }
        } catch (Exception $x) {
            libxml_use_internal_errors($preUseInternalErrors);
            libxml_clear_errors();
            throw $x;
        }
        libxml_use_internal_errors($preUseInternalErrors);

        return $errors;
    }
    /**
     * Check if an xml file satisfy the schema.
     *
     * @param string $filename The name of the file to verify
     *
     * @throws Exception
     *
     * @return string[]|null Return null of all is ok, a list of errors otherwise
     */
    public static function checkFile($filename)
    {
        $fileContents = (is_file($filename) && is_readable($filename)) ? @file_get_contents($filename) : false;
        if ($fileContents === false) {
            throw new Exception('Failed to load the file '.$filename);
        }

        return static::checkString($fileContents, $filename);
    }
    /**
     * Returns the xml schema.
     *
     * @throws Exception Throws an Exception if the xsd file couldn't be read.
     *
     * @return string
     */
    protected static function getSchema()
    {
        static $cache = null;
        if (!isset($cache)) {
            $schemaFile = __DIR__.'/doctrine-xml-0.5.xsd';
            $s = (is_file($schemaFile) && is_readable($schemaFile)) ? @file_get_contents($schemaFile) : false;
            if ($s === false) {
                throw new Exception('Failed to load the schema file '.$schemaFile);
            }
            $cache = $s;
        }

        return $cache;
    }
}
