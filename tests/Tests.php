<?php
use DoctrineXml\Normalizer;
use DoctrineXml\Checker;
use DoctrineXml\Parser;
use PHPUnit\Framework\TestCase;


class Tests extends TestCase
{
    public function testNormalized()
    {
        $minimumGood = '<?xml version="1.0" encoding="UTF-8"?>'."\n".'<schema xmlns="http://www.concrete5.org/doctrine-xml/0.5"/>';
        $minimumBad = '<?xml version="1.0" encoding="UTF-8"?>'."\n".'<SCHEMA xmlns="http://www.concrete5.org/doctrine-xml/0.5"/>';

        $this->assertNotNull(Checker::checkString($minimumBad));
        $this->assertNull(Checker::checkString($minimumGood));

        $this->assertSame($minimumGood, trim(Normalizer::normalizeString($minimumGood)));
        $this->assertSame($minimumGood, trim(Normalizer::normalizeString($minimumBad)));

        $completeBad = <<<EOT
<?xml version="1.0" encoding="UTF-8"?>
<SCHEMA xmlns="http://www.concrete5.org/axmls/0.5">
  <Table name="TableName">
    <field name="FieldName" type="string" size="255">
      <Default value="one@1\nother@0, 2~16, 100, 1000, 10000, 100000, 1000000, …"/>
      <KEY />
    </field>
    <index>
        <col>FieldName</col>
        <UNIQUE />
    </index>
    <References table="OtherTable" onDelete="Cascade">
        <COLUMN Local="FieldName" Foreign="OtherFieldName" />
    </References>
  </Table>
</SCHEMA>
EOT;
        $completeGood = Normalizer::normalizeString($completeBad);
        $this->assertNotNull(Checker::checkString($completeBad));
        $this->assertNull(Checker::checkString($completeGood));
    }

    public function testParser()
    {
        $xml = <<<EOT
<?xml version="1.0" encoding="UTF-8"?>
<schema xmlns="http://www.concrete5.org/doctrine-xml/0.5"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.concrete5.org/doctrine-xml/0.5
    https://concretecms.github.io/doctrine-xml/doctrine-xml-0.5.xsd"
>

  <table name="Companies" comment="List of companies">
    <field name="Id" type="integer" comment="Record identifier">
      <unsigned />
      <autoincrement />
      <key />
    </field>
    <field name="Name" type="string" size="50" comment="Company name">
      <notnull />
    </field>
  </table>

  <table name="Employees">
    <field name="Id" type="integer">
      <unsigned />
      <autoincrement />
      <key />
    </field>
    <field name="IdentificationCode" type="string" size="20">
        <fixed />
    </field>
    <field name="Company" type="integer">
      <unsigned />
      <notnull />
    </field>
    <field name="FirstName" type="string" size="50">
    	<default value="" />
    	<notnull />
    </field>
    <field name="LastName" type="string" size="50">
      <notnull />
    </field>
    <field name="Income" type="decimal" size="10.2">
      <default value="1000" />
    </field>
    <field name="HiredOn" type="datetime">
      <deftimestamp />
    </field>
    <index>
      <fulltext />
      <col>FirstName</col>
    </index>
    <index name="IX_EmployeesIdentificationCode">
      <unique />
      <col>IdentificationCode</col>
    </index>
    <references table="Companies" onupdate="cascade" ondelete="restrict">
      <column local="Company" foreign="Id" />
    </references>
  </table>

</schema>
EOT
        ;
        $expectedSQL = array(
            "CREATE TABLE Companies (Id INT UNSIGNED AUTO_INCREMENT NOT NULL COMMENT 'Record identifier', Name VARCHAR(50) NOT NULL COMMENT 'Company name', PRIMARY KEY(Id)) DEFAULT CHARACTER SET utf8 COLLATE utf8_unicode_ci ENGINE = InnoDB COMMENT = 'List of companies'",
            "CREATE TABLE Employees (Id INT UNSIGNED AUTO_INCREMENT NOT NULL, IdentificationCode CHAR(20) DEFAULT NULL, Company INT UNSIGNED NOT NULL, FirstName VARCHAR(50) DEFAULT '' NOT NULL, LastName VARCHAR(50) NOT NULL, Income NUMERIC(10, 2) DEFAULT '1000', HiredOn DATETIME DEFAULT CURRENT_TIMESTAMP, FULLTEXT INDEX IDX_... (FirstName), UNIQUE INDEX IX_EmployeesIdentificationCode (IdentificationCode), INDEX IDX_... (Company), PRIMARY KEY(Id)) DEFAULT CHARACTER SET utf8 COLLATE utf8_unicode_ci ENGINE = InnoDB",
            "ALTER TABLE Employees ADD CONSTRAINT FK_... FOREIGN KEY (Company) REFERENCES Companies (Id) ON UPDATE CASCADE ON DELETE RESTRICT",
        );

        $platform = new \Doctrine\DBAL\Platforms\MySqlPlatform();
        $schema = Parser::fromDocument($xml, $platform);
        $generatedSQL = $schema->toSql($platform);
        $this->assertSame(count($expectedSQL), count($generatedSQL));
        for ($i = 0; $i < count($expectedSQL); $i++) {
            $fixSQL = trim($generatedSQL[$i]);
            $fixSQL = preg_replace('/ (FK_|IDX_)(\w+) /', ' $1... ', $fixSQL);
            $this->assertSame(trim($expectedSQL[$i]), $fixSQL);
        }
    }

    public function testDefaultDateTime()
    {
        $xml = <<<EOT
<?xml version="1.0" encoding="UTF-8"?>
<schema xmlns="http://www.concrete5.org/doctrine-xml/0.5">
  <table name="Test">
    <field name="Date" type="date">
        <deftimestamp />
    </field>
    <field name="Time" type="time">
        <deftimestamp />
    </field>
    <field name="DateTime" type="datetime">
        <deftimestamp />
    </field>
    <field name="TimeStamp" type="timestamp">
        <deftimestamp />
    </field>
    <field name="DateTimeTZ" type="datetimetz">
        <deftimestamp />
    </field>
  </table>
</schema>
EOT
        ;
        $platform = new \Doctrine\DBAL\Platforms\MySqlPlatform();
        $schema = Parser::fromDocument($xml, $platform);
        $generatedSQL = array_map('trim', $schema->toSql($platform));
        $this->assertSame(
            "CREATE TABLE Test ("
              ."Date DATE DEFAULT CURRENT_DATE, "
              ."Time TIME DEFAULT CURRENT_TIME, "
              ."DateTime DATETIME DEFAULT CURRENT_TIMESTAMP, "
              ."TimeStamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP, "
              ."DateTimeTZ DATETIME DEFAULT CURRENT_TIMESTAMP"
            .") DEFAULT CHARACTER SET utf8 COLLATE utf8_unicode_ci ENGINE = InnoDB",
            implode("\n", $generatedSQL)
        );
    }

    public function testOpt()
    {
        $xml = <<<EOT
<?xml version="1.0" encoding="UTF-8"?>
<schema xmlns="http://www.concrete5.org/doctrine-xml/0.5">
  <table name="Table1">
    <field name="Field11" type="integer">
        <opt for="foo" collate="collateForFoo" />
    </field>
    <field name="Field12" type="integer">
        <opt for="*" collation="collateForAny" />
    </field>
    <field name="Field13" type="integer">
        <opt for="mYsQl" collation="collateForMySQLOnly" />
    </field>
    <field name="Field14" type="integer">
        <opt for="db1,MySQL,db2" collation="collateForMySQLAmongOthers" />
    </field>
    <opt for="*" charset="tableCharset" collate="tableCollation" engine="MyISAM" />
  </table>
</schema>
EOT
        ;
        $platform = new \Doctrine\DBAL\Platforms\MySqlPlatform();
        $schema = Parser::fromDocument($xml, $platform);
        $generatedSQL = array_map('trim', $schema->toSql($platform));
        $this->assertSame(
            "CREATE TABLE Table1 ("
              ."Field11 INT DEFAULT NULL, "
              ."Field12 INT DEFAULT NULL COLLATE collateForAny, "
              ."Field13 INT DEFAULT NULL COLLATE collateForMySQLOnly, "
              ."Field14 INT DEFAULT NULL COLLATE collateForMySQLAmongOthers"
            .") DEFAULT CHARACTER SET tableCharset COLLATE tableCollation ENGINE = MyISAM",
            implode("\n", $generatedSQL)
        );
    }
}
