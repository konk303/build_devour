'use strict';

var _ = require('lodash');
var pluralize = require('pluralize');

function collection(items, included, responseModel) {
  var _this = this;

  return items.map(function (item) {
    return resource.call(_this, item, included, responseModel);
  });
}

function resource(item, included, responseModel) {
  var _this2 = this;

  var model = this.modelFor(pluralize.singular(item.type));
  if (!model) {
    throw new Error('The JSON API response had a type of "' + item.type + '" but Devour expected the type to be "' + responseModel + '".');
  }

  if (model.options.deserializer) {
    return model.options.deserializer.call(this, item);
  }

  var deserializedModel = {};
  if (item.id) {
    deserializedModel.id = item.id;
  }

  _.forOwn(model.attributes, function (value, key) {
    if (isRelationship(value)) {
      deserializedModel[key] = attachRelationsFor.call(_this2, model, value, item, included, key);
    } else {
      deserializedModel[key] = item.attributes[key];
    }
  });

  var params = ['meta', 'links'];
  params.forEach(function (param) {
    if (item[param]) {
      deserializedModel[param] = item[param];
    }
  });

  return deserializedModel;
}

function attachRelationsFor(model, attribute, item, included, key) {
  var relation = null;
  if (attribute.jsonApi === 'hasOne') {
    relation = attachHasOneFor.call(this, model, attribute, item, included, key);
  }
  if (attribute.jsonApi === 'hasMany') {
    relation = attachHasManyFor.call(this, model, attribute, item, included, key);
  }
  return relation;
}

function attachHasOneFor(model, attribute, item, included, key) {
  if (!item.relationships) {
    return null;
  }
  var relatedItems = relatedItemsFor(model, attribute, item, included, key);
  if (relatedItems && relatedItems[0]) {
    return resource.call(this, relatedItems[0], included);
  } else {
    return null;
  }
}

function attachHasManyFor(model, attribute, item, included, key) {
  if (!item.relationships) {
    return null;
  }
  var relatedItems = relatedItemsFor(model, attribute, item, included, key);
  if (relatedItems && relatedItems.length > 0) {
    return collection.call(this, relatedItems, included);
  }
  return [];
}

function isRelationship(attribute) {
  return _.isPlainObject(attribute) && _.includes(['hasOne', 'hasMany'], attribute.jsonApi);
}

/*
 *   == relatedItemsFor
 *   Returns unserialized related items.
 */
function relatedItemsFor(model, attribute, item, included, key) {
  var relationMap = _.get(item.relationships, [key, 'data'], false);
  if (!relationMap) {
    return [];
  }

  if (_.isArray(relationMap)) {
    return _.flatten(_.map(relationMap, function (relationMapItem) {
      return _.filter(included, function (includedItem) {
        return isRelatedItemFor(attribute, includedItem, relationMapItem);
      });
    }));
  } else {
    return _.filter(included, function (includedItem) {
      return isRelatedItemFor(attribute, includedItem, relationMap);
    });
  }
}

function isRelatedItemFor(attribute, relatedItem, relationMapItem) {
  var passesFilter = true;
  if (attribute.filter) {
    passesFilter = _.matches(relatedItem.attributes, attribute.filter);
  }
  return relatedItem.id === relationMapItem.id && relatedItem.type === relationMapItem.type && passesFilter;
}

module.exports = {
  resource: resource,
  collection: collection
};