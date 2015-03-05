$(document).ready(function() {
'use strict';


ace.config.set('basePath', window.location.pathname.replace(/\/+$/, '') + '/js');

function createEditor(id) {
  var editor = ace.edit(id);
  editor.getSession().setMode('ace/mode/xml');
  editor.setOptions({
    showGutter: false,
    showPrintMargin: false,
    highlightActiveLine: false
  });
  switch(id) {
    case 'xml-formatted':
      editor.setReadOnly(true);
      break;
  }
  return editor;
}

var sourceEditor = createEditor('xml-source');
var formattedEditor = createEditor('xml-formatted');

var XSLT = (function() {
  var ext = {
    ready: false
  };
  $.ajax({
    type: 'GET',
    url: 'doctrine-xml-0.5.xsl',
    dataType: 'xml',
  })
  .done(function(doc, status, xhr) {
    ext.error = null;
    try {
      if (window.XSLTProcessor) {
        var p = new XSLTProcessor();
        p.importStylesheet(doc);
        stdProcess.processor = p;
        ext.process = stdProcess;
      } else {
        var isIE = true;
        try {
          var d = new ActiveXObject('Msxml2.DOMDocument.6.0');
          d.async = false;
          d.validateOnParse = true;
          d.loadXML(xhr.responseText);
          if(d.parseError && (d.parseError.errorCode !== 0)) {
            throw d.parseError.reason;
          }
          ieProcess.xslt = d;
          ext.process = ieProcess;
        } catch (e) {
          isIE = false;
        }
        if (!isIE) {
          throw 'Unsupported browser';
        }
      }
    } catch(e) {
      ext.error = 'XSLT failed to initialize: ' + (e.message || e);
    }
    ext.ready = true;
    update(true);
  })
  .fail(function() {
    ext.error = 'Error loading the XSL file';
    ext.ready = true;
    update(true);
  })
  ;

  function stdProcess(sourceXml) {
    var parser = new DOMParser();
    var sourceDoc = parser.parseFromString(sourceXml, 'text/xml');
    if(sourceDoc === null) {
      throw 'Error parsing XML';
    }
    var parserErrors = sourceDoc.getElementsByTagName('parsererror');
    if(parserErrors.length > 0) {
      throw parserErrors[0].textContent;
    }
    sourceDoc.xmlStandalone = true;
    var transformedDoc = stdProcess.processor.transformToDocument(sourceDoc);
    if(!transformedDoc) {
      throw 'Failed to apply XLST (malformed XML?)';
    }
    parserErrors = transformedDoc.getElementsByTagName('parsererror');
    if(parserErrors.length > 0) {
      throw parserErrors[0].textContent;
    }
    transformedDoc.xmlStandalone = true;
    var xmlSerializer = new XMLSerializer();
    var transformedXml = xmlSerializer.serializeToString(transformedDoc);
    if((typeof(transformedXml) !== 'string') || (transformedXml === '')){
      throw 'Error retrieving XML from XML Document';
    }
    if(transformedXml.indexOf('<?xml') !== 0) {
      transformedXml = '<?xml version="1.0" encoding="UTF-8"?>\n' + transformedXml;
    }
    return transformedXml;
  }
  function ieProcess(sourceXml) {
    var sourceDoc = new ActiveXObject('Msxml2.DOMDocument.6.0');
    sourceDoc.async = false;
    sourceDoc.validateOnParse = true;
    sourceDoc.loadXML(sourceXml);
    if(sourceDoc.parseError && (sourceDoc.parseError.errorCode !== 0)) {
      throw 'Error at line ' + sourceDoc.parseError.line + ': ' + sourceDoc.parseError.reason;
    }
    var transformedDoc = new ActiveXObject('Msxml2.DOMDocument.6.0');
    transformedDoc.async = false;
    transformedDoc.validateOnParse = true;
    sourceDoc.transformNodeToObject(ieProcess.xslt, transformedDoc);
    return transformedDoc.xml.replace(/^<\?xml version="1.0"\s*\?>/, '<?xml version="1.0" encoding="UTF-8" ?>');
  }
  return ext;
})();

var XSD = (function() {
  var ext = {
    ready: false
  };
  $.ajax({
    type: 'GET',
    url: 'doctrine-xml-0.5.xsd',
    dataType: 'xml',
  })
  .done(function(data, status, xhr) {
    var xsdXml = xhr.responseText;
    var xs;
    try {
      xs = new ActiveXObject('Msxml2.XMLSchemaCache.6.0');
    } catch(e) {
      xs = null;
    }
    if (xs !== null) {
      try {
        var xsdDoc = new ActiveXObject('Msxml2.DOMDocument.6.0');
        xsdDoc.async = false;
        xsdDoc.validateOnParse = true;
        xsdDoc.loadXML(xsdXml);
        if (xsdDoc.parseError.errorCode != 0) {
          throw xsdDoc.parseError.reason;
        }
        xs.add('http://www.concrete5.org/doctrine-xml/0.5', xsdDoc);
        ieCheck.schema = xs;
        ext.check = ieCheck;
        ext.error = null;
      } catch(e) {
        ext.error = e.message || e;
      }
      ext.ready = true;
      update(true);
    } else {
      $.ajax({
        url: 'js/xmllint.js',
        dataType: 'script',
      })
      .done(function() {
        stdCheck.xsdXml = xsdXml;
        ext.check = stdCheck;
        ext.error = null;
        ext.ready = true;
        update(true);
      })
      .fail(function() {
        ext.error = 'Error loading the XSD validator script';
        ext.ready = true;
        update(true);
      });
    }
  })
  .fail(function() {
    ext.error = 'Error loading the XSD file';
    ext.ready = true;
    update(true);
  });
  function stdCheck(xml) {
    for (var i = 0, n = xml.length; i < n; i++) {
       if (xml.charCodeAt(i) > 255) {
         throw 'XSD validator does not support unicode/multibyte characters (unsupported char: "' + xml[i] + '")';
       }
    }
    var lint = validateXML({
      xml: xml,
      schema: stdCheck.xsdXml,
      arguments: ['--noout', '--schema', 'doctrine-xml-0.5.xsd', 'transformed.xml']
    });
    if (lint.indexOf('xml validates') < 0) {
      throw lint;
    }
  }
  function ieCheck(xml) {
    //var xmldoc = new ActiveXObject('Msxml2.FreeThreadedDOMDocument.6.0');
    var xmldoc = new ActiveXObject('Msxml2.DOMDocument.6.0');
    xmldoc.async = false;
    xmldoc.validateOnParse = true;
    xmldoc.schemas = ieCheck.schema;
    xmldoc.loadXML(xml);
    if (xmldoc.parseError.errorCode !== 0) {
       throw xmldoc.parseError.reason;
    }
  }
  return ext;
})();

var $statusCheck = $('#statusCheck');
var update = (function() {
  var last = null;
  return function(force) {
    var current = sourceEditor.getSession().getValue();
    if ((!force) && (last === current)) {
      return;
    }
    last = current;
    $statusCheck.empty();
    formattedEditor.getSession().setValue('');
    try {
      if(XSLT.ready === false) {
        throw 'XSLT still not loaded';
      }
      if (XSLT.error !== null) {
        throw XSLT.error;
      }
      var transformedXml = XSLT.process(current);
      formattedEditor.getSession().setValue(transformedXml);
      if(XSD.ready === false) {
        throw 'XSD still not loaded';
      }
      if (XSD.error !== null) {
        throw XSD.error;
      }
      XSD.check(transformedXml);
      $statusCheck.text('None.').closest('.panel').removeClass('panel-danger').addClass('panel-success');
    }
    catch(e) {
      $statusCheck.text(e).closest('.panel').removeClass('panel-success').addClass('panel-danger');
    }
  };
})();

update();

sourceEditor.getSession().setValue([
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<schema xmlns="http://www.concrete5.org/doctrine-xml/0.5">',
  '  ',
  '</schema>',
  ''].join('\n'));
sourceEditor.on('change', function() {
  update();
});
sourceEditor.focus();
sourceEditor.moveCursorTo(2, 3);

});