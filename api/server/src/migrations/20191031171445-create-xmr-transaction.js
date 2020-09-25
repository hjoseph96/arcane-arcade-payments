'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('XMRTransactions', {
      id: {
        unique: true,
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
      },
      wallet_id: {
        type: Sequelize.UUID,
        references: {
          model: 'Wallets',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        allowNull: true
      },
      tx_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      key: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      full_hex: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      metadata: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      fee: {
        type: Sequelize.BIGINT,
        allowNull: false
      },
      destinationAddress: {
        type: Sequelize.STRING
      },
      amount: {
        type: Sequelize.BIGINT,
        allowNull: false
      },
      monero_address_id: {
        type: Sequelize.UUID,
        references: {
          model: 'MoneroAddresses',
          key: 'id'
        },
        onUpdate: 'CASCADE'
      },
      confirmations: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      valid: {
        type: Sequelize.BOOLEAN,
        default: false
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
    return queryInterface.dropTable('XMRTransactions');
  }
};