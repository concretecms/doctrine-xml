# Doctrine XML

An XML representation for Doctrine database schemas.

## Online normalization and validation tool

https://concretecms.github.io/doctrine-xml/


## Complete example

Here's an example with all the features offered by Doctrine XML.
Please remark that the header lines `xmlns:xsi="..."` and `xsi:schemaLocation="..."` are not mandatory but may be useful if your XML editor supports autocompletion.

```xml
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
      <opt for="mysql" collation="utf8_bin" />
    </field>
    <opt for="mysql" engine="InnoDB" charset="utf8" collate="utf8_unicode_ci" row_format="compact" />
  </table>

  <table name="Employees" engine="INNODB">
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
```