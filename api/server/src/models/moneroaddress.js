'use strict';
module.exports = (sequelize, DataTypes) => {
  const MoneroAddress = sequelize.define('MoneroAddress', {
    id: {
      unique: true,
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4
    },
    wallet_id: {
      type: DataTypes.UUID,
      references: {
        model: 'Wallets',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      allowNull: true
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
    balance: {
      type: DataTypes.BIGINT,
      defaultValue: 0.0
    },
    address: {
      type: DataTypes.STRING,
      allowNull: false
    },
    deposit_amount: {
      type: DataTypes.DECIMAL,
      defaultValue: 0.0
    },
    trade_id: {
      type: DataTypes.STRING
    },
    expires_at: {
      type: DataTypes.DATE
    },
    subaddressIndex: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    released: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {});

  MoneroAddress.associate = function(models) {
    MoneroAddress.belongsTo(models.Wallet, { foreignKey: 'wallet_id' });
    MoneroAddress.hasOne(models.XMRTransaction, { foreign_key: 'monero_address_id' });
  };

  return MoneroAddress;
};
