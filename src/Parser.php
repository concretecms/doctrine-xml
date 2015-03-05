<?php
namespace DoctrineXml;

use Exception;

/**
 * Parse doctrine-xml data.
 */
class Parser
{
    /**
     * @param string $filename
     * @param \Doctrine\DBAL\Platforms\AbstractPlatform $platform
     * @param bool $checkXml
     * @param bool $normalizeXml
     *
     * @throws Exception
     *
     * @return \Doctrine\DBAL\Schema\Schema
     */
    public static function fromFile($filename, \Doctrine\DBAL\Platforms\AbstractPlatform $platform, $checkXml = true, $normalizeXml = false)
    {
        if (!is_file($filename)) {
            throw new Exception('Unable to find the file '.$filename);
        }
        if (!is_readable($filename)) {
            throw new Exception('File not readable: '.$filename);
        }
        $xml = @file_get_contents($filename);
        if ($xml === false) {
            throw new Exception('Error reading from file: '.$filename);
        }

        return static::fromString($xml, $checkXml, $normalizeXml);
    }
    /**
     * @param string $xml
     * @param \Doctrine\DBAL\Platforms\AbstractPlatform $platform
     * @param bool $checkXml
     * @param bool $normalizeXml
     *
     * @throws Exception
     *
     * @return \Doctrine\DBAL\Schema\Schema
     */
    public static function fromString($xml, \Doctrine\DBAL\Platforms\AbstractPlatform $platform, $checkXml = true, $normalizeXml = false)
    {
        if ($normalizeXml) {
            $xml = Normalizer::normalizeString($xml);
        }
        if ($checkXml) {
            $errors = Checker::checkString($xml);
            if (isset($errors)) {
                throw new Exception(implode("\n", $errors));
            }
        }
        $xDoc = @simplexml_load_string($xml);
        if (empty($xDoc)) {
            throw new Exception('Failed to load the XML code');
        }

        $schema = new \Doctrine\DBAL\Schema\Schema();
        foreach ($xDoc->table as $xTable) {
            $table = $schema->createTable((string) $xTable['name']);
            $engine = (string) $xTable['engine'];
            if ($engine !== '') {
                $table->addOption('engine', $engine);
            }
            $comment = (string) $xTable['comment'];
            if ($comment !== '') {
                $table->addOption('comment', $comment);
            }
            foreach ($xTable->field as $xField) {
                $fieldOptions = array();
                if (isset($xField->unsigned)) {
                    $fieldOptions['unsigned'] = true;
                }
                if (isset($xField->autoincrement)) {
                    $fieldOptions['autoincrement'] = true;
                }
                if (isset($xField->default)) {
                    $fieldOptions['default'] = (string) $xField->default['value'];
                }
                if (isset($xField->deftimestamp)) {
                    $fieldOptions['default'] = $platform->getCurrentTimestampSQL();
                }
                if (isset($xField->notnull)) {
                    $fieldOptions['notnull'] = true;
                }
                $size = (string) $xField['size'];
                if ($size !== '') {
                    switch ((string) $xField['type']) {
                        case 'decimal':
                        case 'float':
                            $precisionAndScale = explode('.', $size);
                            $fieldOptions['precision'] = (int) $precisionAndScale[0];
                            if (isset($precisionAndScale[1])) {
                                $fieldOptions['scale'] = (int) $precisionAndScale[1];
                            }
                            break;
                        default:
                            $fieldOptions['length'] = (int) $size;
                            break;
                    }
                }
                $field = $table->addColumn((string) $xField['name'], (string) $xField['type'], $fieldOptions);
                $comment = (string) $xField['comment'];
                if ($comment !== '') {
                    $field->setComment($comment);
                }
            }
        }

        return $schema;
    }
}
