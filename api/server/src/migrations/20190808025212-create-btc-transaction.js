'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('BTCTransactions', {
      id: {
        unique: true,
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
      },
      payment_outputs: {
        type: Sequelize.ARRAY(Sequelize.JSONB)
      },
      payment_inputs: {
        type: Sequelize.ARRAY(Sequelize.JSONB)
      },
      raw_transaction: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      transaction_id: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      wallet_id: {
        type: Sequelize.UUID,
        references: {
          model: 'Wallets',
          key: 'id'
        },
        onUpdate: 'CASCADE'
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
    return queryInterface.dropTable('BTCTransactions');
  }
};