## 02 - Generate TypeComposers

First we need to create our TypeComposer.
The TypeComposer is a extended version of the GraphQLObjectType object.
Other than having all the standards of a GraphQLObjectType it has all the functions you need to manipulate when you need.
Guess what? It also has the object connection to the database so you only need to provide the filter, limits, projection +++ details you need.

Now lets get to the it on shall we?

Converting a Mongoose model to TypeComposer (wrapped GraphQLObjectType).
```js
import mongoose from 'mongoose';
import composeWithMongoose from 'graphql-compose-mongoose';

var PersonSchema = new mongoose.Schema({
  firstName: { type: String },
  lastName: { type: String },
  email: { type: String },
});
export const Person = mongoose.model('Person', PersonSchema);
export const PersonTC = composeWithMongoose(Person);
```

yey, thats all..
