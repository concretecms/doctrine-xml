<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet
	version="2.0"
	xmlns="http://www.concrete5.org/doctrine-xml/0.5"
	xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
	xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
	xmlns:tmp="http://tempuri.org"
	exclude-result-prefixes="xsi"
>
	<xsl:output method="xml" indent="yes" encoding="UTF-8" omit-xml-declaration="no" />
	<xsl:strip-space elements="*" />

	<!-- Keep comments -->
	<xsl:template match="comment()">
		<xsl:copy />
	</xsl:template>

	<!-- Process elements -->
	<xsl:template match="*">
		<!-- Render element as lower-case -->
   	<xsl:variable name="lowerCaseElementName" select="translate(name(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')" />
      <xsl:element name="{$lowerCaseElementName}" namespace="http://www.concrete5.org/doctrine-xml/0.5">
      	<!-- Let's parse the attributes -->
      	<xsl:for-each select="@*">
      		<xsl:variable name="lowerCaseAttributeName" select="translate(name(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')" />
      		<xsl:choose>
      			<!-- Strip the 'xsi:schemaLocation' attribute, if present -->
      			<xsl:when test="$lowerCaseAttributeName = 'xsi:schemalocation'">
      			</xsl:when>
      			<!-- The 'type' attribute is only for the field definition: it should be always lower-case -->
      			<xsl:when test="$lowerCaseAttributeName = 'type'">
      				<xsl:attribute name="{$lowerCaseAttributeName}"><xsl:value-of select="translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')"/></xsl:attribute>
      			</xsl:when>
      			<!-- The 'onupdate' attribute is only for the foreign tables definition: it should be always lower-case -->
      			<xsl:when test="$lowerCaseAttributeName = 'onupdate'">
      				<xsl:attribute name="{$lowerCaseAttributeName}"><xsl:value-of select="translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')"/></xsl:attribute>
      			</xsl:when>
      			<!-- The 'ondelete' attribute is only for the foreign tables definition: it should be always lower-case -->
      			<xsl:when test="$lowerCaseAttributeName = 'ondelete'">
      				<xsl:attribute name="{$lowerCaseAttributeName}"><xsl:value-of select="translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')"/></xsl:attribute>
      			</xsl:when>
      			<xsl:otherwise>
      				<xsl:attribute name="{$lowerCaseAttributeName}"><xsl:value-of select="."/></xsl:attribute>
      			</xsl:otherwise>
      		</xsl:choose>
			</xsl:for-each>
			<!-- Let's parse the child nodes -->
			<xsl:choose>
				<!-- Sort children of table (field, index, opt, references) -->
				<xsl:when test="$lowerCaseElementName = 'table'">
					<xsl:apply-templates>
						<xsl:sort select="translate(name(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')" data-type="text" order="ascending" />
					</xsl:apply-templates> 
				</xsl:when>
				<!-- Sort children of field (autoincrement, key, default|deftimestamp, unsigned, notnull, fixed, opt) -->
				<xsl:when test="$lowerCaseElementName = 'field'">
					<xsl:apply-templates select="node()[translate(name(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz') = 'unsigned']" />
					<xsl:apply-templates select="node()[translate(name(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz') = 'autoincrement']" />
					<xsl:apply-templates select="node()[translate(name(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz') = 'key']" />
					<xsl:apply-templates select="node()[translate(name(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz') = 'default']" />
					<xsl:apply-templates select="node()[translate(name(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz') = 'deftimestamp']" />
					<xsl:apply-templates select="node()[translate(name(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz') = 'notnull']" />
					<xsl:apply-templates select="node()[translate(name(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz') = 'fixed']" />
					<xsl:apply-templates select="node()[translate(name(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz') = 'opt']" />
				</xsl:when>
				<!-- Sort children of index (unique, fulltext, col) -->
				<xsl:when test="$lowerCaseElementName = 'index'">
					<xsl:apply-templates select="node()[translate(name(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz') = 'unique']" />
					<xsl:apply-templates select="node()[translate(name(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz') = 'fulltext']" />
					<xsl:apply-templates select="node()[translate(name(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz') = 'col']" />
				</xsl:when>
				<xsl:otherwise>
					<xsl:apply-templates />
				</xsl:otherwise>
			</xsl:choose>
		</xsl:element>
   </xsl:template>

</xsl:stylesheet>
