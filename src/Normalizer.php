<?php
namespace DoctrineXml;

use Exception;
use XSLTProcessor;

/**
 * Normalize and verify doctrine-xml data.
 */
class Normalizer
{
    /**
     * Normalize an xml code resolving some common errors.
     *
     * @param string $xml The xml code to fix
     * @param string $filename The name of the file from which the xml code has been read from
     *
     * @throws Exception Throws an Exception in case of problems (for instance if the xml string is not a valid XML document)
     *
     * @return string
     */
    public static function normalizeString($xml, $filename = '')
    {
        $doc = Utilities::stringToDOMDocument($xml, $filename);
        $xslt = static::getXsltDOMDocument();
        $error = null;
        $preUseInternalErrors = libxml_use_internal_errors(true);
        try {
            $processor = new XSLTProcessor();
            $processor->importStyleSheet($xslt);
            $normalized = $processor->transformToXml($doc);
            if ($normalized === false) {
                $error = Utilities::explainLibXmlErrors($filename);
            }
        } catch (Exception $x) {
            libxml_use_internal_errors($preUseInternalErrors);
            libxml_clear_errors();
            throw $x;
        }
        if (isset($error)) {
            throw new Exception($error);
        }

        $doc = Utilities::stringToDOMDocument($normalized, $filename);
        $doc->formatOutput = true;

        return $doc->saveXML();
    }
    /**
     * Normalize an xml code resolving some common errors.
     *
     * @param string $filename The name of the file containing the xml code fo fix
     * @param bool|string $save If false the function just returns the normalized string, if true $filename will be overwritten with the normalized string; use a string to save the normalized string to a new file.
     *
     * @throws Exception Throws an Exception in case of problems (for instance if the xml string is not a valid XML document)
     *
     * @return string
     */
    public static function normalizeFile($filename, $save = false)
    {
        $fileContents = (is_file($filename) && is_readable($filename)) ? @file_get_contents($filename) : false;
        if ($fileContents === false) {
            throw new Exception('Failed to load the file '.$filename);
        }
        $normalizedString = static::normalizeString($fileContents, $filename);

        $savedAs = null;
        if (is_string($save) && ($save !== '')) {
            $savedAs = $save;
        } elseif ($save === true) {
            $savedAs = $filename;
        }
        if (isset($savedAs)) {
            if (@file_put_contents($savedAs, $normalizedString) === false) {
                throw new Exception('Failed to write to '.$savedAs);
            }
        }

        return $normalizedString;
    }
    /**
     * Return the XSLT document that fixes a source xml file.
     *
     * @throws Exception Throws an Exception if the xsd file couldn't be read.
     *
     * @return DOMDocument
     */
    protected static function getXsltDOMDocument()
    {
        static $cache = null;
        $xsltFile = __DIR__.'/doctrine-xml-0.5.xsl';
        if (!isset($cache)) {
            $s = (is_file($xsltFile) && is_readable($xsltFile)) ? @file_get_contents($xsltFile) : false;
            if ($s === false) {
                throw new Exception('Failed to load the xslt file '.$xsltFile);
            }
            $cache = $s;
        }

        return Utilities::stringToDOMDocument($cache, $xsltFile);
    }
}
