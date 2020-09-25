'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('MoneroAddresses', {
      id: {
        unique: true,
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
      },
      wallet_id: {
        allowNull: true,
        type: Sequelize.UUID,
        references: {
          model: 'Wallets',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      address: {
        unique: true,
        type: Sequelize.STRING
      },
      destination_address: {
        type: Sequelize.STRING
      },
      active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      balance: {
        type: Sequelize.BIGINT
      },
      released: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      deposit_amount: {
        type: Sequelize.BIGINT
      },
      trade_id: {
        type: Sequelize.STRING
      },
      subaddressIndex: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      expires_at: {
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('MoneroAddresses');
  }
};
