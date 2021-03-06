/* @flow */

import { GraphQLInputObjectType, GraphQLNonNull } from 'graphql';
import { resolveMaybeThunk } from './utils/misc';
import { deprecate } from './utils/debug';
import { isObject, isString } from './utils/is';
import { resolveInputConfigsAsThunk, keepConfigsAsThunk } from './utils/configAsThunk';
import TypeMapper from './typeMapper';
import { typeByPath } from './typeByPath';

import type {
  Thunk,
  GraphQLInputObjectTypeConfig,
  GraphQLInputFieldConfig,
  GraphQLInputFieldConfigMap,
  GraphQLInputType,
  TypeNameString,
  TypeDefinitionString,
} from './definition';

export default class InputTypeComposer {
  gqType: GraphQLInputObjectType;

  static create(
    opts:
      | TypeDefinitionString
      | TypeNameString
      | GraphQLInputObjectTypeConfig
      | GraphQLInputObjectType
  ) {
    let ITC;

    if (isString(opts)) {
      // $FlowFixMe
      const typeName: string = opts;
      const NAME_RX = /^[_a-zA-Z][_a-zA-Z0-9]*$/;
      if (NAME_RX.test(typeName)) {
        ITC = new InputTypeComposer(
          new GraphQLInputObjectType({
            name: typeName,
            fields: () => ({}),
          })
        );
      } else {
        const type = TypeMapper.createType(typeName);
        if (!(type instanceof GraphQLInputObjectType)) {
          throw new Error('You should provide correct GraphQLInputObjectType type definition.');
        }
        ITC = new InputTypeComposer(type);
      }
    } else if (opts instanceof GraphQLInputObjectType) {
      ITC = new InputTypeComposer(opts);
    } else if (isObject(opts)) {
      // $FlowFixMe
      const type = new GraphQLInputObjectType({
        ...opts,
        fields: () => ({}),
      });
      ITC = new InputTypeComposer(type);

      // $FlowFixMe
      if (isObject(opts.fields)) {
        // $FlowFixMe
        ITC.addFields(opts.fields);
      }
    } else {
      throw new Error(
        'You should provide InputObjectConfig or string with type name to InputTypeComposer.create(opts)'
      );
    }

    return ITC;
  }

  constructor(gqType: GraphQLInputObjectType) {
    if (!(gqType instanceof GraphQLInputObjectType)) {
      throw new Error('InputTypeComposer accept only GraphQLInputObjectType in constructor');
    }
    this.gqType = gqType;
  }

  /**
   * Get fields from a GraphQL type
   * WARNING: this method read an internal GraphQL instance variable.
   */
  getFields(): GraphQLInputFieldConfigMap {
    const fields: Thunk<GraphQLInputFieldConfigMap> = this.gqType._typeConfig.fields;

    // $FlowFixMe
    const fieldMap: mixed = keepConfigsAsThunk(resolveMaybeThunk(fields));

    if (isObject(fieldMap)) {
      // $FlowFixMe
      return Object.assign({}, fieldMap);
    }
    return {};
  }

  getFieldNames(): string[] {
    return Object.keys(this.getFields());
  }

  hasField(fieldName: string): boolean {
    const fields = this.getFields();
    return !!fields[fieldName];
  }

  /**
   * Completely replace all fields in GraphQL type
   * WARNING: this method rewrite an internal GraphQL instance variable.
   */
  setFields(fields: GraphQLInputFieldConfigMap): InputTypeComposer {
    const prepearedFields = TypeMapper.convertInputFieldConfigMap(fields, this.getTypeName());

    this.gqType._typeConfig.fields = () =>
      resolveInputConfigsAsThunk(prepearedFields, this.getTypeName());
    delete this.gqType._fields; // if schema was builded, delete defineFieldMap
    return this;
  }

  setField(fieldName: string, fieldConfig: GraphQLInputFieldConfig): InputTypeComposer {
    this.addFields({ [fieldName]: fieldConfig });
    return this;
  }

  /**
  * @deprecated 2.0.0
  */
  addField(fieldName: string, fieldConfig: GraphQLInputFieldConfig) {
    deprecate('Use InputTypeComposer.setField() or plural addFields({}) instead.');
    this.addFields({ [fieldName]: fieldConfig });
  }

  /**
   * Add new fields or replace existed in a GraphQL type
   */
  addFields(newFields: GraphQLInputFieldConfigMap): InputTypeComposer {
    this.setFields(Object.assign({}, this.getFields(), newFields));
    return this;
  }

  /**
   * Get fieldConfig by name
   */
  getField(fieldName: string): ?GraphQLInputFieldConfig {
    const fields = this.getFields();

    if (fields[fieldName]) {
      return fields[fieldName];
    }

    return undefined;
  }

  removeField(fieldNameOrArray: string | Array<string>): InputTypeComposer {
    const fieldNames = Array.isArray(fieldNameOrArray) ? fieldNameOrArray : [fieldNameOrArray];
    const fields = this.getFields();
    fieldNames.forEach(fieldName => delete fields[fieldName]);
    this.setFields(fields);
    return this;
  }

  removeOtherFields(fieldNameOrArray: string | Array<string>): InputTypeComposer {
    const keepFieldNames = Array.isArray(fieldNameOrArray) ? fieldNameOrArray : [fieldNameOrArray];
    const fields = this.getFields();
    Object.keys(fields).forEach(fieldName => {
      if (!keepFieldNames.includes(fieldName)) {
        delete fields[fieldName];
      }
    });
    this.setFields(fields);
    return this;
  }

  extendField(name: string, parialFieldConfig: GraphQLInputFieldConfig): InputTypeComposer {
    const fieldConfig = Object.assign({}, this.getField(name), parialFieldConfig);
    this.setField(name, fieldConfig);
    return this;
  }

  reorderFields(names: string[]): InputTypeComposer {
    const orderedFields = {};
    const fields = this.getFields();
    names.forEach(name => {
      if (fields[name]) {
        orderedFields[name] = fields[name];
        delete fields[name];
      }
    });
    this.setFields({ ...orderedFields, ...fields });
    return this;
  }

  isRequired(fieldName: string): boolean {
    return this.getFieldType(fieldName) instanceof GraphQLNonNull;
  }

  getFieldType(fieldName: string): GraphQLInputType | void {
    const field = this.getField(fieldName);
    if (field) {
      return field.type;
    }

    return undefined;
  }

  /**
  * @deprecated 2.0.0
  */
  isFieldRequired(fieldName: string): boolean {
    deprecate('Use InputTypeComposer.isRequired() instead.');
    return this.isRequired(fieldName);
  }

  makeRequired(fieldNameOrArray: string | Array<string>): InputTypeComposer {
    const fieldNames = Array.isArray(fieldNameOrArray) ? fieldNameOrArray : [fieldNameOrArray];
    const fields = this.getFields();
    fieldNames.forEach(fieldName => {
      if (fields[fieldName] && fields[fieldName].type) {
        if (!(fields[fieldName].type instanceof GraphQLNonNull)) {
          fields[fieldName].type = new GraphQLNonNull(fields[fieldName].type);
        }
      }
    });
    this.setFields(fields);
    return this;
  }

  /**
  * @deprecated 2.0.0
  */
  makeFieldsRequired(fieldNameOrArray: string | Array<string>) {
    deprecate('Use InputTypeComposer.makeRequired() instead.');
    this.makeRequired(fieldNameOrArray);
  }

  makeOptional(fieldNameOrArray: string | Array<string>): InputTypeComposer {
    const fieldNames = Array.isArray(fieldNameOrArray) ? fieldNameOrArray : [fieldNameOrArray];
    const fields = this.getFields();
    fieldNames.forEach(fieldName => {
      if (fieldNames.includes(fieldName)) {
        if (fields[fieldName].type instanceof GraphQLNonNull) {
          fields[fieldName].type = fields[fieldName].type.ofType;
        }
      }
    });
    this.setFields(fields);
    return this;
  }

  /**
  * @deprecated 2.0.0
  */
  makeFieldsOptional(fieldNameOrArray: string | Array<string>) {
    deprecate('Use InputTypeComposer.makeOptional() instead.');
    this.makeOptional(fieldNameOrArray);
  }

  clone(newTypeName: string): InputTypeComposer {
    if (!newTypeName) {
      throw new Error('You should provide new type name for clone() method');
    }

    const fields = this.getFields();
    const newFields = {};
    Object.keys(fields).forEach(fieldName => {
      newFields[fieldName] = Object.assign({}, fields[fieldName]);
    });

    return new InputTypeComposer(
      new GraphQLInputObjectType({
        name: newTypeName,
        fields: newFields,
      })
    );
  }

  getType(): GraphQLInputObjectType {
    return this.gqType;
  }

  getTypeAsRequired(): GraphQLNonNull<GraphQLInputObjectType> {
    return new GraphQLNonNull(this.gqType);
  }

  getTypeName(): string {
    return this.gqType.name;
  }

  setTypeName(name: string): InputTypeComposer {
    this.gqType.name = name;
    return this;
  }

  getDescription(): string {
    return this.gqType.description || '';
  }

  setDescription(description: string): InputTypeComposer {
    this.gqType.description = description;
    return this;
  }

  /**
  * @deprecated 2.0.0
  */
  getByPath(path: string | Array<string>): mixed {
    deprecate('Use InputTypeComposer.get() instead.');
    return this.get(path);
  }

  get(path: string | Array<string>): mixed {
    return typeByPath(this, path);
  }
}
