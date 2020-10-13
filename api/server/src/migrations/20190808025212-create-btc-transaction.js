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
      monero_address_id: {
        type: Sequelize.UUID,
        references: {
          model: 'BitcoinAddresses',
          key: 'id'
        },
        onUpdate: 'CASCADE'
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
