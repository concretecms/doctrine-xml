<?php

namespace DoctrineXml;

use Exception;
use SimpleXMLElement;
use Doctrine\DBAL\Platforms\AbstractPlatform;
use Doctrine\DBAL\Schema\Schema;
use Doctrine\DBAL\Schema\Table;
use Doctrine\DBAL\Schema\Column;
use Doctrine\DBAL\Schema\SchemaConfig;

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
     * @param callable|null $tableFilter
     * @param string|null $platformVersion
     * @param \Doctrine\DBAL\Schema\SchemaConfig|null $schemaConfig
     *
     * @throws Exception
     *
     * @return Schema
     */
    public static function fromFile($filename, AbstractPlatform $platform, $checkXml = true, $normalizeXml = false, $tableFilter = null, $platformVersion = null, SchemaConfig $schemaConfig = null)
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

        return static::fromDocument($xml, $platform, $checkXml, $normalizeXml, $tableFilter, $platformVersion, $schemaConfig);
    }

    /**
     * @param string|SimpleXMLElement $xml
     * @param AbstractPlatform $platform
     * @param bool $checkXml
     * @param bool $normalizeXml
     * @param callable|null $tableFilter
     * @param string|null $platformVersion
     * @param \Doctrine\DBAL\Schema\SchemaConfig|null $schemaConfig
     *
     * @throws Exception
     *
     * @return Schema
     */
    public static function fromDocument($xml, AbstractPlatform $platform, $checkXml = true, $normalizeXml = false, $tableFilter = null, $platformVersion = null, SchemaConfig $schemaConfig = null)
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
            if (!is_object($xDoc)) {
                $errors = Utilities::explainLibXmlErrors();
                libxml_clear_errors();
                libxml_use_internal_errors($preUseInternalErrors);
                throw new Exception(implode("\n", $errors));
            }
            libxml_use_internal_errors($preUseInternalErrors);
        }
        if ($schemaConfig === null) {
            $schema = new Schema();
        } else {
            $schema = new Schema(array(), array(), $schemaConfig);
        }
        foreach ($xDoc->table as $xTable) {
            if (isset($tableFilter) && ($tableFilter((string) $xTable['name']) === false)) {
                continue;
            }
            static::parseTable($schema, $xTable, $platform, $platformVersion);
        }

        return $schema;
    }

    protected static function parseTable(Schema $schema, SimpleXMLElement $xTable, AbstractPlatform $platform, $platformVersion = null)
    {
        $table = $schema->createTable((string) $xTable['name']);
        $comment = (string) $xTable['comment'];
        if ($comment !== '') {
            $table->addOption('comment', $comment);
        }
        $primaryKeyFields = array();
        foreach ($xTable->field as $xField) {
            static::parseField($schema, $table, $xField, $platform, $platformVersion);
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
        static::parseTableOpts($schema, $table, $xTable, $platform, $platformVersion);
        foreach ($xTable->references as $xReferences) {
            static::parseForeignKey($schema, $table, $xReferences, $platform);
        }
    }

    protected static function parseField(Schema $schema, Table $table, SimpleXMLElement $xField, AbstractPlatform $platform, $platformVersion = null)
    {
        $type = (string) $xField['type'];
        $version = false;
        switch ($type) {
            case 'timestamp':
                $type = 'datetime';
                $version = true;
                break;
        }
        $field = $table->addColumn((string) $xField['name'], $type);
        if ($version) {
            $field->setPlatformOption('version', true);
        }
        $field->setUnsigned(isset($xField->unsigned));
        $field->setAutoincrement(isset($xField->autoincrement));
        if (isset($xField->default)) {
            $field->setDefault((string) $xField->default['value']);
        } elseif (isset($xField->deftimestamp)) {
            switch ($type) {
                case 'date':
                    $field->setDefault($platform->getCurrentDateSQL());
                    break;
                case 'time':
                    $field->setDefault($platform->getCurrentTimeSQL());
                    break;
                default:
                    $field->setDefault($platform->getCurrentTimestampSQL());
                    break;
            }
        }
        if (isset($xField->notnull) || isset($xField->autoincrement) || isset($xField->key)) {
            $field->setNotnull(true);
        } else {
            $field->setNotnull(false);
        }
        $field->setFixed(isset($xField->fixed));
        $size = (string) $xField['size'];
        if ($size !== '') {
            switch ($type) {
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
        static::parseFieldOpts($schema, $field, $xField, $platform, $platformVersion);
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

    protected static function getOptArray(SimpleXMLElement $xOptParent, AbstractPlatform $platform, $platformVersion = null)
    {
        $result = array();
        foreach ($xOptParent->opt as $xOpt) {
            $forThisPlatform = false;
            foreach (explode(',', (string) $xOpt['for']) as $for) {
                $for = trim($for);
                if (preg_match('/^(.+?)(<|<=|=|>=|>|!=|<>)(\d+(?:\.\d+)*)$/', $for, $matches) && $matches[1] !== '*') {
                    $forPlatform = $matches[1];
                    $forVersionOperator = $matches[2];
                    $forVersion = $matches[3];
                } else {
                    $forPlatform = $for;
                    $forVersionOperator = null;
                    $forVersion = null;
                }
                if ($forPlatform === '*' || strcasecmp($forPlatform, $platform->getName()) === 0) {
                    if ($forVersion === null) {
                        $forThisPlatform = true;
                        break;
                    }
                    if ($platformVersion === null) {
                        if (in_array($forVersionOperator, array('<', '<=', '!=', '<>'))) {
                            $forThisPlatform = true;
                            break;
                        }
                    } else {
                        if (version_compare($platformVersion, $forVersion, $forVersionOperator)) {
                            $forThisPlatform = true;
                            break;
                        }
                    }
                }
            }
            if ($forThisPlatform) {
                foreach ($xOpt->attributes() as $name => $value) {
                    if ($name !== 'for') {
                        $value = trim((string) $value);
                        if ($value !== '') {
                            $result[$name] = $value;
                        }
                    }
                }
            }
        }

        return $result;
    }

    protected static function parseTableOpts(Schema $schema, Table $table, SimpleXMLElement $xOptParent, AbstractPlatform $platform, $platformVersion = null)
    {
        $opts = static::getOptArray($xOptParent, $platform, $platformVersion);
        foreach ($opts as $name => $value) {
            $table->addOption($name, $value);
        }
    }
    protected static function parseFieldOpts(Schema $schema, Column $field, SimpleXMLElement $xOptParent, AbstractPlatform $platform, $platformVersion = null)
    {
        $opts = static::getOptArray($xOptParent, $platform, $platformVersion);
        foreach ($opts as $name => $value) {
            $field->setPlatformOption($name, $value);
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
