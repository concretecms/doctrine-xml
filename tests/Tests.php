<?php
use DoctrineXml\Normalizer;
use DoctrineXml\Checker;

class Tests extends PHPUnit_Framework_TestCase
{
    public function testNormalized()
    {
        $minimumGood = '<?xml version="1.0" encoding="UTF-8"?>'."\n".'<schema xmlns="http://www.concrete5.org/doctrine-xml/0.5"/>';
        $minimumBad = '<?xml version="1.0" encoding="UTF-8"?>'."\n".'<SCHEMA xmlns="http://www.concrete5.org/doctrine-xml/0.5"/>';

        $this->assertNotNull(Checker::checkString($minimumBad));
        $this->assertNull(Checker::checkString($minimumGood));

        $this->assertSame(trim(Normalizer::normalizeString($minimumGood)), $minimumGood);
        $this->assertSame(trim(Normalizer::normalizeString($minimumBad)), $minimumGood);

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
        <FullText />
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
}
