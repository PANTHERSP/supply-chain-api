const { v4: uuidv4 } = require('uuid');

const id = uuidv4();
console.log(typeof id);
console.log(id);
console.log(new Date().getTime());