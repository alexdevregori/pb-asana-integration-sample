const xslt = `<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="3.0">
<xsl:output omit-xml-declaration="yes" indent="yes"/>
  <xsl:mode on-no-match="text-only-copy"/>
  <xsl:template match="h1">
    <strong><xsl:apply-templates/></strong>
  </xsl:template>
  <xsl:template match="h2">
    <strong><xsl:apply-templates/></strong>
  </xsl:template>
  <xsl:template match="b">
    <strong><xsl:apply-templates/></strong>
  </xsl:template>
  <xsl:template match="b">
    <strong><xsl:apply-templates/></strong>
  </xsl:template>
  <xsl:template match="i">
    <em><xsl:apply-templates/></em>
  </xsl:template>
  <xsl:template match="u">
    <u><xsl:apply-templates/></u>
  </xsl:template>
  <xsl:template match="pre">
    <code><xsl:apply-templates/></code>
  </xsl:template>
  <xsl:template match="u">
    <xsl:copy>
      <xsl:apply-templates/>
    </xsl:copy>
  </xsl:template>
  <xsl:template match="code">
    <xsl:copy>
      <xsl:apply-templates/>
    </xsl:copy>
  </xsl:template>
  <xsl:template match="ol">
    <xsl:copy>
      <xsl:apply-templates/>
    </xsl:copy>
  </xsl:template>
  <xsl:template match="ul">
    <xsl:copy>
      <xsl:apply-templates/>
    </xsl:copy>
  </xsl:template>
  <xsl:template match="li">
    <xsl:copy>
      <xsl:apply-templates/>
    </xsl:copy>
  </xsl:template>
  <xsl:template match="s">
    <xsl:copy>
      <xsl:apply-templates/>
    </xsl:copy>
  </xsl:template>
  <xsl:template match="a">
    <xsl:copy>
      <xsl:copy-of select="@*"/>
      <xsl:apply-templates/>
    </xsl:copy>
</xsl:template>
</xsl:stylesheet>`;
