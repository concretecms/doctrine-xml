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

function normalizeDXML(xml, includeSchemaLocation) {
  xml = (typeof xml === 'string') ? $.trim(xml) : '';
  var i = xml.indexOf('<schema');
  if (i < 0) {
    xml = '';
  } else {
    xml = xml.substr(i);
    i = xml.indexOf('>');
    if (i <= 0) {
      xml = '';
    } else {
      xml = $.trim(xml.substr(i + 1));
      if (xml === '</schema>') {
        xml = '';
      }
      var start = '<schema';
      var xmlns = 'xmlns="http://www.concrete5.org/doctrine-xml/0.5"';
      if (includeSchemaLocation) {
        start += '\n  ' + xmlns;
        start += '\n  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"';
        start += '\n  xsi:schemaLocation="http://www.concrete5.org/doctrine-xml/0.5 http://concrete5.github.io/doctrine-xml/doctrine-xml-0.5.xsd"';
        start += '\n' + ((xml === '') ? '/>' : '>');
      } else {
        start += ' ' + xmlns + ((xml === '') ? '/>' : '>');
      }
      if (xml !== '') {
        xml = xml.replace(/\n+[ \t]*<table/g, '\n\n  <table').replace(/\n+<\/schema>/g, '\n\n</schema>');
        if (xml.indexOf('<table') === 0) {
          xml = '\n  ' + xml;
        }
        xml = xml.replace(/\n\t\t\t\t\t/g, '\n          ').replace(/\n\t\t\t\t/g, '\n        ').replace(/\n\t\t\t/g, '\n      ').replace(/\n\t\t/g, '\n    ').replace(/\n\t/g, '\n  ');
      }
      xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + ((xml === '') ? start : (start + '\n' + xml)) + '\n';
    }
  }
  return xml;
}

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

  function stdProcess(sourceXml, includeSchemaLocation) {
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
    return normalizeDXML(transformedXml, includeSchemaLocation);
  }
  function ieProcess(sourceXml, includeSchemaLocation) {
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
    return normalizeDXML(transformedDoc.xml, includeSchemaLocation);
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
        if (xsdDoc.parseError.errorCode) {
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

var convertFromAXMLS = (function() {
  var nodeType = {
    element: 1,
    attribute: 2,
    text: 3,
    cdataSection: 4,
    entityReference: 5,
    entity: 6,
    processingInstruction: 7,
    comment: 8,
    document: 9,
    document_type: 10,
    documentFragment: 11,
    notation: 12
  };
  
  function stringToDoc(string) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(string, 'text/xml');
    if(doc === null) {
      throw 'Error parsing XML.';
    }
    var parserErrors = doc.getElementsByTagName('parsererror');
    if(parserErrors.length > 0) {
      throw (parserErrors[0].textContent || parserErrors[0].innerText || '');
    }
    doc.xmlStandalone = true;
    return doc;
  }
  function getAttributes(node) {
    var result = {};
    var l = node.attributes.length;
    for (var a, k = 0; k < l; k++) {
      a = node.attributes.item(k);
      result[a.name.toLowerCase()] = a.value;
    }
    return result;
  }
  function getAttribute(node, name) {
    var a = getAttributes(node);
    return (name in a) ? a[name] : null;
  }
  function getChildElements(node, filterName) {
    var result = [];
    for(var child, i = 0; i < node.childNodes.length; i++) {
      child = node.childNodes[i];
      if (child.nodeType === nodeType.element) {
        if ((!filterName) || (filterName === child.nodeName.toLowerCase())) { 
          result.push(child);
        }
      }
    }
    return result;
  }
  function setAttribute(doc, node, name, value) {
    var attribute = doc.createAttribute(name);
    attribute.nodeValue = value;
    node.setAttributeNode(attribute);
  }


  function convertTable(fromTable, toDoc, toParent) {
    var toTable = toDoc.createElement('table');
    var name = null;
    var attributes = getAttributes(fromTable);
    for(var attributeName in attributes) {
      switch (attributeName) {
        case 'name':
          name = $.trim(attributes[attributeName]);
          if (name === '') {
            throw 'A table element has an empty "name" attribute.';
          }
          break;
        default:
          throw 'Unknown table attribute: "' + attributeName + '".';
      }
    }
    if (name === null) {
      throw 'A table element is missing the "name" attribute.';
    }
    setAttribute(toDoc, toTable, 'name', name);
    var fields = getChildElements(fromTable, 'field');
    if (fields.length === 0) {
      throw 'A table element is missing field definitions.';
    }
    fields.forEach(function(field) {
      convertTableField(field, toDoc, toTable);
    });
    getChildElements(fromTable, 'index').forEach(function(index) {
      convertTableIndex(index, toDoc, toTable);
    });
    convertTableOpts(getChildElements(fromTable, 'opt'), toDoc, toTable);
    //Check unknown child nodes
    getChildElements(fromTable).forEach(function(child) {
      switch (child.nodeName.toLowerCase()) {
        case 'field':
        case 'index':
        case 'opt':
          break;
        default:
          throw 'Unexpected table child node: "' + child.nodeName + '".';
      }
    });
    toParent.appendChild(toTable);
  }
  function convertTableField(fromField, toDoc, toTable) {
    var toField = toDoc.createElement('field');
    var name = null, fromType = null, fromSize = null, fromSizeInt = null;
    var attributes = getAttributes(fromField);
    for(var attributeName in attributes) {
      switch (attributeName) {
        case 'name':
          name = $.trim(attributes[attributeName]);
          if (name === '') {
            throw 'A field element has an empty "name" attribute.';
          }
          break;
        case 'type':
          fromType = $.trim(attributes[attributeName]);
          if (fromType === '') {
            throw 'A field element has an empty "type" attribute.';
          }
          break;
        case 'size':
          fromSize = attributes[attributeName];
          if (fromSize === '') {
            fromSize = null;
          } else {
            fromSizeInt = parseInt(fromSize, 10);
            if (!fromSizeInt) {
              fromSizeInt = 0;
            }
          }
          break;
        default:
          throw 'Unknown field attribute: "' + attributeName + '".';
      }
    }
    if (name === null) {
      throw 'A field element is missing the "name" attribute.';
    }
    if (fromType === null) {
      throw 'A field element is missing the "type" attribute.';
    }
    setAttribute(toDoc, toField, 'name', name);
    var toType = null, toSize = null;
    switch (fromType.toUpperCase()) {
      case 'X':
        toType = 'text';
        toSize = 65535;
        break;
      case 'X2':
        toType = 'text';
        break;
      case 'C':
      case 'C2':
        toType = 'string';
        if (fromSize === null) {
          toSize = 255;
        } else {
          if (fromSizeInt <= 0) {
            throw 'The varchar field "' + name + '" has an invalid value for the "size" attribute ("' + fromSize + '").';
          }
          toSize = fromSizeInt;
        }
        break;
      case 'X2':
      case 'XL':
        toType = 'text';
        if (fromSize !== null) {
          if (fromSizeInt <= 0) {
            throw 'The text field "' + name + '" has an invalid value for the "size" attribute ("' + fromSize + '").';
          }
          toSize = fromSizeInt;
        }
        break;
      case 'L':
        toType = 'boolean';
        break;
      case 'I1':
        toType = 'smallint';
        if (fromSize === null) {
          toType = 'boolean';
        } else {
          if (fromSizeInt <= 0) {
            throw 'The integer field "' + name + '" has an invalid value for the "size" attribute ("' + fromSize + '").';
          } else if (fromSizeInt === 1) {
            toType = 'boolean';
          } else {
            toSize = fromSizeInt;
          }
        }
        break;
      case 'I2':
        toType = 'smallint';
        if (fromSize !== null) {
          if (fromSizeInt <= 0) {
            throw 'The integer field "' + name + '" has an invalid value for the "size" attribute ("' + fromSize + '").';
          }
          toSize = fromSizeInt;
        }
        break;
      case 'I':
        toType = 'integer';
        if (fromSize !== null) {
          if (fromSizeInt <= 0) {
            throw 'The integer field "' + name + '" has an invalid value for the "size" attribute ("' + fromSize + '").';
          } else if (fromSizeInt === 1) {
            toType = 'boolean';
          } else if (fromSizeInt < 5) {
            toType = 'smallint';
          } else {
            toSize = fromSizeInt;
          }
        }
        break;
      case 'I4':
        toType = 'integer';
        if (fromSize !== null) {
          if (fromSizeInt <= 0) {
            throw 'The integer field "' + name + '" has an invalid value for the "size" attribute ("' + fromSize + '").';
          }
          toSize = fromSizeInt;
        }
        break;
      case 'I8':
        toType = 'bigint';
        if (fromSize !== null) {
          if (fromSizeInt <= 0) {
            throw 'The integer field "' + name + '" has an invalid value for the "size" attribute ("' + fromSize + '").';
          }
          toSize = fromSizeInt;
        }
        break;
      case 'T':
      case 'TS':
        toType = 'datetime';
        break;
      case 'TIME':
        toType = 'time';
        break;
      case 'D':
        toType = 'date';
        break;
      case 'B':
        toType = 'blob';
        if (fromSize !== null) {
          if (fromSizeInt <= 0) {
            throw 'The blob field "' + name + '" has an invalid value for the "size" attribute ("' + fromSize + '").';
          }
          toSize = fromSizeInt;
        }
        break;
      case 'F':
        toType = 'float';
        if (fromSize !== null) {
          if (/^\d+(\.\d+)?$/.test(fromSize)) {
            toSize = fromSize;
          } else {
            throw 'The float field "' + name + '" has an invalid value for the "size" attribute ("' + fromSize + '").';
          }
        }
        break;
      case 'N':
        toType = 'decimal';
        if (fromSize !== null) {
          if (/^\d+(\.\d+)?$/.test(fromSize)) {
            toSize = fromSize;
          } else {
            throw 'The decimal field "' + name + '" has an invalid value for the "size" attribute ("' + fromSize + '").';
          }
        }
        break;
    }
    if (toType === null) {
        throw 'Unknown field type: "' + fromType + '".';
    }
    if (getChildElements(fromField, 'unsigned').length > 0) {
      toField.appendChild(toDoc.createElement('unsigned'));
    }
    if (getChildElements(fromField, 'autoincrement').length > 0) {
      toField.appendChild(toDoc.createElement('autoincrement'));
    }
    if ((getChildElements(fromField, 'key').length > 0) || (getChildElements(fromField, 'primary').length > 0)) {
      toField.appendChild(toDoc.createElement('key'));
    }
    var toDefault = null;
    [
      {key: 'default'},
      {key: 'def'},
      {key: 'defdate', deftimestamp: true},
      {key: 'deftimestamp', deftimestamp: true}
    ].forEach(function(def) {
      var l = getChildElements(fromField, def.key);
      if (l.length === 0) {
        return;
      }
      if (toDefault) {
        throw 'The field "' + name + '" has multiple default values.';
      }
      if (def.deftimestamp) {
        if (toType === 'datetime') {
          toType = 'timestamp';
        }
        toDefault = toDoc.createElement('deftimestamp');
      } else {
        var value = getAttribute(l[0], 'value');
        if (value === null) {
          throw 'The float field "' + name + '" has a default node without value.';
        }
        toDefault = toDoc.createElement('default');
        setAttribute(toDoc, toDefault, 'value', value);
      }
    });
    if (toDefault) {
      toField.appendChild(toDefault);
    }
    if (getChildElements(fromField, 'notnull').length > 0) {
      if (getChildElements(fromField, 'null').length > 0) {
        throw 'The field "' + name + '" has bot a NULL and a NOTNULL child nodes.';
      }
      toField.appendChild(toDoc.createElement('notnull'));
    }
    setAttribute(toDoc, toField, 'type', toType);
    if (toSize !== null) {
      setAttribute(toDoc, toField, 'size', toSize);
    }
    // Check unknown child nodes
    getChildElements(fromField).forEach(function(child) {
      switch(child.nodeName.toLowerCase()) {
        case 'unsigned':
        case 'autoincrement':
        case 'key':
        case 'default':
        case 'def':
        case 'defdate':
        case 'deftimestamp':
        case 'notnull':
        case 'null':
          break;
        default:
          throw 'The field "' + name + '" has an invalid child node: "' + child.nodeName + '".';
      }
    });
    toTable.appendChild(toField);
  }
  function convertTableIndex(fromIndex, toDoc, toTable) {
    var toIndex = toDoc.createElement('index');
    var name = null;
    var attributes = getAttributes(fromIndex);
    for(var attributeName in attributes) {
      switch (attributeName) {
        case 'name':
          name = attributes[attributeName];
          break;
        default:
          throw 'Unknown index attribute: "' + attributeName + '".';
      }
    }
    if (name !== null) {
      setAttribute(toDoc, toIndex, 'name', name);
    }
    if (getChildElements(fromIndex, 'unique').length > 0) {
      toIndex.appendChild(toDoc.createElement('unique'));
    } else if (getChildElements(fromIndex, 'fulltext').length > 0) {
      toIndex.appendChild(toDoc.createElement('fulltext'));
    }
    var cols = getChildElements(fromIndex, 'col');
    if (cols.length === 0) {
      throw 'An index element is missing col definitions.';
    }
    cols.forEach(function(fromCol) {
      var toCol = toDoc.createElement('col');
      toCol.innerHTML = fromCol.innerHTML;
      toIndex.appendChild(toCol);
    });
    // Check unknown child nodes
    getChildElements(fromIndex).forEach(function(child) {
      switch(child.nodeName.toLowerCase()) {
        case 'unique':
        case 'fulltext':
        case 'col':
          break;
        default:
          throw 'An index has an invalid child node: "' + child.nodeName + '".';
      }
    });
    toTable.appendChild(toIndex);
  }
  function convertTableOpts(fromOpts, toDoc, toTable) {
    var platformOpts = {};
    fromOpts.forEach(function(fromOpt) {
      var platform = getAttribute(fromOpt, 'platform');
      if (platform) {
        if (/^mysql/i.test(platform)) {
          platform = 'MySQL';
        }
        var s = (fromOpt.textContent || fromOpt.innerText || ''); 
        s.replace(/[;,\s]+/g, ' ').split(' ').forEach(function(keyValue) {
          var m = /^\s*(\w+)\s*=\s*(\w+)\s*$/.exec(keyValue);
          if (!m) {
            throw 'Unable to parse the OPT "' + s + '": bad key/value pair.';
          }
          var key = m[1].toLowerCase();
          var value = m[2];
          if (!(platform in platformOpts)) {
            platformOpts[platform] = {};
          }
          if (key in platformOpts[platform]) {
            if (platformOpts[platform][key].toLowerCase() !== value.toLowerCase()) {
              throw 'Unable to parse the OPT "' + s + '": different values for the same platform and key.';
            }
          } else {
            platformOpts[platform][key] = value;
          }
        });
      }
    });
    var toOpt;
    for (var platform in platformOpts) {
      toOpt = toDoc.createElement('opt');
      setAttribute(toDoc, toOpt, 'for', platform);
      for (var optKey in platformOpts[platform]) {
        setAttribute(toDoc, toOpt, optKey, platformOpts[platform][optKey]);
      }
      toTable.appendChild(toOpt);
    }
  }

  return function(axmls, includeSchemaLocation) {
    if (!axmls) {
      throw 'Please specify the source AXMLS.';
    }
    var fromDoc = stringToDoc(axmls);
    var fromSchema = (fromDoc.childNodes.length === 1) ? fromDoc.childNodes[0] : null;
    if (fromSchema === null) {
      throw 'No root element found.';
    }
    if (fromSchema.nodeName.toLowerCase() !== 'schema') {
      throw 'Root element should be "schema", "' + fromSchema.nodeName + '" found.';
    }
    var schemaVersion = getAttribute(fromSchema, 'version');
    if (schemaVersion === null) {
      throw 'The root element (schema) must have a "version" attribute.';
    }
    if (schemaVersion !== '0.3') {
      throw 'The schema version should be "0.3", "'+ schemaVersion + '" was found.';
    }
    var toDoc = stringToDoc('<?xml version="1.0" encoding="UTF-8"?><schema xmlns="http://www.concrete5.org/doctrine-xml/0.5" />');
    var toRoot = toDoc.childNodes[0];
    getChildElements(fromSchema).forEach(function(child) {
      switch (child.nodeName.toLowerCase()) {
        case 'table':
          convertTable(child, toDoc, toRoot);
          break;
        default:
          throw 'Unexpected node: "' + child.nodeName + '".';
      }
    });
    var oSerializer = new XMLSerializer();
    var result = oSerializer.serializeToString(toDoc);
    result = result.replace(/\s+xmlns=""/g, '');
    result = vkbeautify.xml(result, 2);
    return normalizeDXML(result, includeSchemaLocation);
  };
})();

function Action(name, inName, outName, initialSource, process) {
  var me = this;
  me.name = name;
  me.inName = inName;
  me.outName = outName;
  me.process = process;
  me.initialSource = '';
  me.initialSourceCursor = null;
  if (initialSource) {
    var p = initialSource.indexOf('<<CURSOR>>');
    if (p >= 0) {
      var s = initialSource.substr(0, p);
      me.initialSourceCursor = {row: s.replace(/[^\n]/g, '').length, column: s.substr(s.lastIndexOf('\n')).length - 1};
      initialSource = s + initialSource.substr(p + '<<CURSOR>>'.length);
    }
    me.initialSource = initialSource;
  }
  var m = /^(.*)<<CURSOR>>(.*)$/mg.exec(me.initialSource);
  Action.all.push(me);
  $('.dx-actions').append(
    me.btn = $('<button type="button" class="btn btn-default" />')
      .text(name)
      .on('click', function() {
        me.activate();
      })
  );
}
Action.prototype = {
  activate: function() {
    Action.activate(this);
  }
};
Action.active = null;
Action.all = [];
Action.activate = function(action) {
  if (Action.active === action) {
    return;
  }
  var currentSource = sourceEditor.getSession().getValue();
  if (Action.active !== null) {
    if ((Action.active.initialSource.length > 0) && (currentSource === Action.active.initialSource)) {
      sourceEditor.getSession().setValue(currentSource = '');
    } 
  }
  Action.active = null;
  $('.sx-in-name').empty();
  $('.sx-out-name').empty();
  $.each(Action.all, function() {
    if (this === action) {
      Action.active = this;
      $('.sx-in-name').text(this.inName);
      $('.sx-out-name').text(this.outName);
      this.btn.removeClass('btn-default').addClass('btn-primary');
      if ((this.initialSource.length > 0) && (currentSource === '')) {
        sourceEditor.getSession().setValue(this.initialSource);
        if (this.initialSourceCursor) {
          sourceEditor.focus();
          sourceEditor.moveCursorTo(this.initialSourceCursor.row, this.initialSourceCursor.column);
        }
      }
    } else {
      this.btn.removeClass('btn-primary').addClass('btn-default');
    }
  });
  update(true);
}; 
new Action(
  'Normalize Doctrine XML',
  'Doctrine XML to normalize',
  'Normalized XML',
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<schema xmlns="http://www.concrete5.org/doctrine-xml/0.5">',
    '  <<CURSOR>>',
    '</schema>',
  ''].join('\n'),
  function(data) {
    try {
      if(XSD.ready === false) {
        throw 'XSD still not loaded';
      }
      if (XSD.error !== null) {
        throw XSD.error;
      }
      XSD.check(data.source);
    } catch(e) {
      data.sourceError = e;
    }
    try {
      if(XSLT.ready === false) {
        throw 'XSLT still not loaded';
      }
      if (XSLT.error !== null) {
        throw XSLT.error;
      }
      data.destination = XSLT.process(data.source, $('#add-schemalocation input').is(':checked'));
    } catch (e) {
      data.destinationError = e;
    }
  }
);
new Action(
  'Convert from AXMLS',
  'AXMLS to convert',
  'Resulting Doctrine XML',
  [
   '<?xml version="1.0" encoding="UTF-8"?>',
   '<schema version="0.3">',
   '  <<CURSOR>>',
   '</schema>',
 ''].join('\n'),
  function(data) {
    try {
      data.destination = convertFromAXMLS(data.source, $('#add-schemalocation input').is(':checked'));
    } catch (e) {
      data.sourceError = e;
    }
  }
);

var $checkSource = $('#check-source');
var $checkFormatted = $('#check-formatted');
var update = (function() {
  var lastSource = null;
  return function(force) {
    var source = sourceEditor.getSession().getValue();
    if ((!force) && (lastSource === source)) {
      return;
    }
    lastSource = source;
    $checkSource.empty().closest('.panel').removeClass('panel-default panel-danger panel-success');
    $checkFormatted.empty().closest('.panel').removeClass('panel-default panel-danger panel-success');
    formattedEditor.getSession().setValue('');
    if (Action.active === null) {
      $checkSource.text('Please select an operation').closest('.panel').addClass('panel-danger');
      return;
    }
    var data = {
      source: source,
      sourceError: null,
      destination: '',
      destinationError: null
    };
    Action.active.process(data);
    if (data.sourceError === null) {
      $checkSource.text('Good!').closest('.panel').addClass('panel-success');
    } else {
      $checkSource.text(data.sourceError).closest('.panel').addClass('panel-danger');
    }
    if ((data.destination !== '') && (data.destinationError === null)) {
      try {
        if(XSD.ready === false) {
          throw 'XSD still not loaded';
        }
        if (XSD.error !== null) {
          throw XSD.error;
        }
        XSD.check(data.destination);
      } catch (err) {
        data.destinationError = err;
      }
    }
    if (data.destinationError === null) {
      $checkFormatted.text((data.destination === '') ? '' : 'Good!').closest('.panel').addClass('panel-success');
    } else {
      $checkFormatted.text(data.destinationError).closest('.panel').addClass('panel-danger');
    }
    if (data.destination !== '') {
      formattedEditor.getSession().setValue(data.destination);
    }
  };
})();

$('#selectall-formatted').on('click', function() {
  formattedEditor.selectAll();
  formattedEditor.focus();
});
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

Action.all[0].activate();

sourceEditor.on('change', function() {
  update();
});

$('#add-schemalocation input').on('change', function() {
  update(true);
});

});