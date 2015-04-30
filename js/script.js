(function() {
'use strict';
ZeroClipboard.config({
  swfPath: window.location.pathname.replace(/\/+$/, '') + '/js/ZeroClipboard-2.2.0.swf'
});

})();

$(document).ready(function() {
'use strict';

ace.config.set('basePath', window.location.pathname.replace(/\/+$/, '') + '/js');

function createEditor(id) {
  var editor = ace.edit(id);
  editor.getSession().setMode('ace/mode/xml');
  editor.setOptions({
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
         if (window.console && window.console.warn) {
           window.console.warn('Replaced unsupported char "' + xml[i] + '" with "?" during XSD validation.');
         }
         xml = xml.substr(0, i) + '?' + xml.substr(i + 1);
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

var $checkSource = $('#check-source');
var $checkFormatted = $('#check-formatted');
var update = (function() {
  var lastXml = null;
  return function(force) {
    var currentXml = sourceEditor.getSession().getValue();
    if ((!force) && (lastXml === currentXml)) {
      return;
    }
    lastXml = currentXml;
    $checkSource.empty().closest('.panel').removeClass('panel-default panel-danger panel-success');
    try {
      if(XSD.ready === false) {
        throw 'XSD still not loaded';
      }
      if (XSD.error !== null) {
        throw XSD.error;
      }
      XSD.check(currentXml);
      $checkSource.text('Good!').closest('.panel').addClass('panel-success');
    } catch(e) {
      $checkSource.text(e).closest('.panel').addClass('panel-danger');
    }
    
    $checkFormatted.empty().closest('.panel').removeClass('panel-default panel-danger panel-success');
    formattedEditor.getSession().setValue('');
    var transformedXml = '';
    try {
      if(XSLT.ready === false) {
        throw 'XSLT still not loaded';
      }
      if (XSLT.error !== null) {
        throw XSLT.error;
      }
      transformedXml = XSLT.process(currentXml);
      formattedEditor.getSession().setValue(transformedXml);
      if(XSD.ready === false) {
        throw 'XSD still not loaded';
      }
      if (XSD.error !== null) {
        throw XSD.error;
      }
      XSD.check(transformedXml);
      $checkFormatted.text('Good!').closest('.panel').addClass('panel-success');
    }
    catch(e) {
      if (transformedXml === '') {
        $checkFormatted.closest('.panel').addClass('panel-default');
      } else {
        $checkFormatted.text(e).closest('.panel').addClass('panel-danger');
      }
    }
  };
})();

$('#selectall-formatted').on('click', function() {
  formattedEditor.selectAll();
  formattedEditor.focus();
})
var copyFormatted = new ZeroClipboard($('#copy-formatted'));
copyFormatted.on('ready', function(event) {
  $('#selectall-formatted').hide();
  $('#copy-formatted').show();
});
copyFormatted.on('copy', function(event) {
  var formattedXml = formattedEditor.getSession().getValue();
  event.clipboardData.setData('text/plain', formattedXml);
  event.clipboardData.setData('text/xml', formattedXml);
});
copyFormatted.on('aftercopy', function() {
  var delay = {'in': 100, stay: 1000, out: 100};
  $('#copy-formatted-done').show(
    delay['in'],
    function() {
      setTimeout(
        function() {
          $('#copy-formatted-done').hide(delay.out);
        },
        delay.stay
      );
    }
  );
});

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