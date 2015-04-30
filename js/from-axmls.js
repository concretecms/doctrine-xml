/* jshint unused:vars, undef:true, browser:true, jquery:true */
/* global vkbeautify */

$(document).ready(function() {
'use strict';

var nodeType = {
  element: 1,
  attribute: 2,
  text: 3,
  comment: 8
};

function stringToDoc(string) {
  var parser = new DOMParser();
  var doc = parser.parseFromString(string, 'text/xml');
  if(doc === null) {
    throw 'Error parsing XML.';
  }
  var parserErrors = doc.getElementsByTagName('parsererror');
  if(parserErrors.length > 0) {
    throw parserErrors[0].textContent;
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

function covert(axmls, includeSchemaLocation) {
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
  var baseXml = '<?xml version="1.0" encoding="UTF-8"?>';
  baseXml += '<schema xmlns="http://www.concrete5.org/doctrine-xml/0.5"';
  if (includeSchemaLocation) {
    baseXml += ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.concrete5.org/doctrine-xml/0.5 http://concrete5.github.io/doctrine-xml/doctrine-xml-0.5.xsd"';
  }
  baseXml += ' />';
  var toDoc = stringToDoc(baseXml);
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
  var result = vkbeautify.xml(oSerializer.serializeToString(toDoc), 2);
  result = '<?xml version="1.0" encoding="UTF-8"?>\n' + result.substr(result.indexOf('<schema'));
  result = result.replace(/\n  <table/g, '\n\n  <table');
  return result;
}

function convertTable(fromTable, toDoc, toParent) {
  var toTable = toDoc.createElement('table');
  var name = null;
  var attributes = getAttributes(fromTable);
  for(var attributeName in attributes) {
    switch (attributeName) {
      case 'name':
        name = attributes[attributeName];
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
        name = attributes[attributeName];
        break;
      case 'type':
        fromType = attributes[attributeName];
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
      if (fromSize !== null) {
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
      fromOpt.textContent.replace(/[;,\s]+/g, ' ').split(' ').forEach(function(keyValue) {
        var m = /^\s*(\w+)\s*=\s*(\w+)\s*$/.exec(keyValue);
        if (!m) {
          throw 'Unable to parse the OPT "' + fromOpt.textContent + '": bad key/value pair.';
        }
        var key = m[1].toLowerCase();
        var value = m[2];
        if (!(platform in platformOpts)) {
          platformOpts[platform] = {};
        }
        if (key in platformOpts[platform]) {
          if (platformOpts[platform][key].toLowerCase() !== value.toLowerCase()) {
            throw 'Unable to parse the OPT "' + fromOpt.textContent + '": different values for the same platform and key.';
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

var lastConverted = null;
function update(force) {
  var from = $('#from').val();
  if ((!force) && (from === lastConverted)) {
    return;
  }
  lastConverted = from;
  try {
    var to = covert(from, $('#schemaLocation').is(':checked'));
    $('#to').removeClass('err').addClass('xml').text(to);
  } catch (e) {
      $('#to').addClass('err').removeClass('xml').text(e.toString());
  }
}
$('#from').on('change keypress keydown keyup blur mouseup click', function() {
  update();
});
$('#schemaLocation').on('change', function() {
  update(true);
});

update();

});
