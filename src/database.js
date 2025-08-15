// database.js

const Sequelize = require('sequelize');
// Use SQLite in-memory for demo purposes
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: ':memory:'
});
const Person = sequelize.define('Person', {
    firstName: {
        type: Sequelize.STRING,
        allowNull: false
    },
    lastName: {
        type: Sequelize.STRING,
        allowNull: true
    },
    // Add id field for explicit control
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    }
});
// Add a function to initialize dummy data
async function seedDummyData() {
    await sequelize.sync();
    await Person.bulkCreate([
        { firstName: 'Alice', lastName: 'Smith' },
        { firstName: 'Bob', lastName: 'Johnson' },
        { firstName: 'Charlie', lastName: 'Brown' }
    ]);
}

module.exports = {
    sequelize: sequelize,
    Person: Person,
    seedDummyData: seedDummyData
};