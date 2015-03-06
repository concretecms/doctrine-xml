<?php
namespace DoctrineXml;

use Exception;
use SimpleXMLElement;
use Doctrine\DBAL\Platforms\AbstractPlatform;
use Doctrine\DBAL\Schema\Schema;
use Doctrine\DBAL\Schema\Table;

/**
 * Parse doctrine-xml data.
 */
class Parser
{
    /**
     * @param string $filename
     * @param AbstractPlatform $platform
     * @param bool $checkXml
     * @param bool $normalizeXml
     *
     * @throws Exception
     *
     * @return Schema
     */
    public static function fromFile($filename, AbstractPlatform $platform, $checkXml = true, $normalizeXml = false)
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

        return static::fromDocument($xml, $checkXml, $normalizeXml);
    }
    /**
     * @param string|SimpleXMLElement $xml
     * @param AbstractPlatform $platform
     * @param bool $checkXml
     * @param bool $normalizeXml
     *
     * @throws Exception
     *
     * @return Schema
     */
    public static function fromDocument($xml, AbstractPlatform $platform, $checkXml = true, $normalizeXml = false)
    {
        if ($checkXml || $normalizeXml) {
            if (is_a($xml, '\SimpleXMLElement')) {
                $xml = $xml->asXML();
            }
            if ($normalizeXml) {
                $xml = Normalizer::normalizeString($xml);
            }
            if ($checkXml) {
                $errors = Checker::checkString($xml);
                if (isset($errors)) {
                    throw new Exception(implode("\n", $errors));
                }
            }
        }
        if (is_a($xml, '\SimpleXMLElement')) {
            $xDoc = $xml;
        } else {
            $preUseInternalErrors = libxml_use_internal_errors(true);
            libxml_clear_errors();
            $xDoc = @simplexml_load_string($xml);
            if (empty($xDoc)) {
                $errors = Utilities::explainLibXmlErrors();
                libxml_clear_errors();
                libxml_use_internal_errors($preUseInternalErrors);
                throw new Exception(implode("\n", $errors));
            }
            libxml_use_internal_errors($preUseInternalErrors);
        }
        $schema = new Schema();
        foreach ($xDoc->table as $xTable) {
            static::parseTable($schema, $xTable, $platform);
        }

        return $schema;
    }

    protected static function parseTable(Schema $schema, SimpleXMLElement $xTable, AbstractPlatform $platform)
    {
        $table = $schema->createTable((string) $xTable['name']);
        $engine = (string) $xTable['engine'];
        if ($engine !== '') {
            $table->addOption('engine', $engine);
        }
        $comment = (string) $xTable['comment'];
        if ($comment !== '') {
            $table->addOption('comment', $comment);
        }
        $primaryKeyFields = array();
        foreach ($xTable->field as $xField) {
            static::parseField($schema, $table, $xField, $platform);
            if (isset($xField->key) || isset($xField->autoincrement)) {
                $primaryKeyFields[] = (string) $xField['name'];
            }
        }
        if (!empty($primaryKeyFields)) {
            $table->setPrimaryKey($primaryKeyFields);
        }
        foreach ($xTable->index as $xIndex) {
            static::parseIndex($schema, $table, $xIndex, $platform);
        }
        foreach ($xTable->references as $xReferences) {
            static::parseForeignKey($schema, $table, $xReferences, $platform);
        }
    }

    protected static function parseField(Schema $schema, Table $table, SimpleXMLElement $xField, AbstractPlatform $platform)
    {
        $field = $table->addColumn((string) $xField['name'], (string) $xField['type']);
        $field->setUnsigned(isset($xField->unsigned));
        $field->setAutoincrement(isset($xField->autoincrement));
        if (isset($xField->default)) {
            $field->setDefault((string) $xField->default['value']);
        } elseif (isset($xField->deftimestamp)) {
            $field->setDefault($platform->getCurrentTimestampSQL());
        }
        if (isset($xField->notnull) || isset($xField->autoincrement) || isset($xField->key)) {
            $field->setNotnull(true);
        } else {
            $field->setNotnull(false);
        }
        $field->setFixed(isset($xField->fixed));
        $size = (string) $xField['size'];
        if ($size !== '') {
            switch ((string) $xField['type']) {
                case 'decimal':
                case 'float':
                    $precisionAndScale = explode('.', $size);
                    $field->setPrecision($precisionAndScale[0]);
                    if (isset($precisionAndScale[1])) {
                        $field->setScale($precisionAndScale[1]);
                    }
                    break;
                default:
                    $field->setLength($size);
                    break;
            }
        }
        $comment = (string) $xField['comment'];
        if ($comment !== '') {
            $field->setComment($comment);
        }
    }

    protected static function parseIndex(Schema $schema, Table $table, SimpleXMLElement $xIndex, AbstractPlatform $platform)
    {
        $s = (string) $xIndex['name'];
        $indexName = ($s === '') ? null : $s;
        $fieldNames = array();
        foreach ($xIndex->col as $col) {
            $fieldNames[] = (string) $col;
        }
        if (isset($xIndex->unique)) {
            $table->addUniqueIndex($fieldNames, $indexName);
        } else {
            $flags = array();
            if (isset($xIndex->fulltext)) {
                $flags[] = 'FULLTEXT';
            }
            $table->addIndex($fieldNames, $indexName, $flags);
        }
    }

    protected static function parseForeignKey(Schema $schema, Table $table, SimpleXMLElement $xForeignKey, AbstractPlatform $platform)
    {
        $foreignTable = (string) $xForeignKey['table'];
        $localColumnNames = array();
        $foreignColumnNames = array();
        foreach ($xForeignKey->column as $xColumn) {
            $localColumnNames[] = (string) $xColumn['local'];
            $foreignColumnNames[] = (string) $xColumn['foreign'];
        }
        $constraintName = isset($xForeignKey['name']) ? (string) $xForeignKey['name'] : null;
        $options = array();
        if (isset($xForeignKey['onupdate'])) {
            $options['onUpdate'] = (string) $xForeignKey['onupdate'];
        }
        if (isset($xForeignKey['ondelete'])) {
            $options['onDelete'] = (string) $xForeignKey['ondelete'];
        }
        $table->addForeignKeyConstraint($foreignTable, $localColumnNames, $foreignColumnNames, $options, $constraintName);
    }
}
