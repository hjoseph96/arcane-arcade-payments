'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('Wallets', {
      id: {
        allowNull: false,
        defaultValue: Sequelize.UUIDV4,
        unique: true,
        primaryKey: true,
        type: Sequelize.UUID
      },
      btc_balance: {
        type: Sequelize.DECIMAL,
        allowNull: false,
        defaultValue: 0.00
      },
      ltc_balance: {
        type: Sequelize.DECIMAL,
        allowNull: false,
        defaultValue: 0.00
      },
      xmr_balance: {
        type: Sequelize.BIGINT,
        allowNull: false,
        defaultValue: 0.00
      },
      user_id: {
        type: Sequelize.INTEGER,
        unique: true,
        allowNull: true
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
    return queryInterface.dropTable('Wallets');
  }
};
