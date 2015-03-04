<?php
namespace DoctrineXml;

use Exception;
use DOMDocument;

/**
 * Helper functions.
 */
class Utilities
{
    /**
     * Convert a string containing xml code to a DOMDocument.
     *
     * @param string $xml The xml code
     * @param string $filename The name of the file from which the xml code has been read from
     *
     * @return DOMDocument
     */
    public static function stringToDOMDocument($xml, $filename = '')
    {
        $preUseInternalErrors = libxml_use_internal_errors(true);
        try {
            libxml_clear_errors();
            $doc = new DOMDocument();
            if (@$doc->loadXML($xml) === false) {
                throw new Exception(empty($filename) ? 'Failed to parse xml' : ('Failed to load file '.$filename));
            }
        } catch (Exception $x) {
            libxml_use_internal_errors($preUseInternalErrors);
            libxml_clear_errors();
            throw $x;
        }
        libxml_use_internal_errors($preUseInternalErrors);

        return $doc;
    }
    /**
     * Explain the libxml errors encountered.
     *
     * @param string $filename The name of the file to which the errors are related.
     *
     * @return string[]
     */
    public static function explainLibXmlErrors($filename = '')
    {
        $errors = libxml_get_errors();
        $result = array();
        if (empty($errors)) {
            $result[] = 'Unknown libxml error';
        } else {
            foreach ($errors as $error) {
                switch ($error->level) {
                    case LIBXML_ERR_WARNING:
                        $level = 'Warning';
                        break;
                    case LIBXML_ERR_ERROR:
                        $level = 'Error';
                        break;
                    case LIBXML_ERR_FATAL:
                        $level = 'Fatal error';
                        break;
                    default:
                        $level = 'Unknown error';
                        break;
                }
                $description = $level.' '.trim($error->message);
                if (!empty($filename)) {
                    $description .= "\n  File: $filename";
                }
                $description .= "\n  Line: {$error->line}";
                $description .= "\n  Code: {$error->code}";
                $result[] = $description;
            }
        }

        return $result;
    }
}
