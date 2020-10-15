'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('BitcoinAddresses', {
      id: {
        unique: true,
        allowNull: false,
        primaryKey: true,
        type: Sequelize.INTEGER,
        autoincrement: true
      },
      balance: {
        type: Sequelize.DECIMAL
      },
      deposit_amount: {
        type: Sequelize.DECIMAL
      },
      seg_wit_address: {
        type: Sequelize.STRING
      },
      destination_address: {
        type: Sequelize.STRING,
      },
      redeem_script: {
        type: Sequelize.STRING
      },
      private_key: {
        type: Sequelize.STRING
      },
      public_key: {
        type: Sequelize.STRING
      },
      wif: {
        type: Sequelize.STRING
      },
      address: {
        active: true,
        allowNull: false,
        type: Sequelize.STRING
      },
      active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      central: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      released: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      expires_at: {
        type: Sequelize.DATE
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('BitcoinAddresses');
  }
};
