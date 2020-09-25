'use strict';
module.exports = (sequelize, DataTypes) => {
  const XMRTransaction = sequelize.define('XMRTransaction', {
    id: {
      type:DataTypes.UUID,
      allowNull:false,
      unique:true,
      primaryKey:true,
      defaultValue: DataTypes.UUIDV4
    },
    tx_id: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    key: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true
    },
    full_hex: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true
    },
    metadata: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true
    },
    amount: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    fee: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    confirmations: {
      type: DataTypes.INTEGER,
      allowNull: false
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
    monero_address_id: {
      type: DataTypes.UUID,
      references: {
        model: 'Wallets',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      allowNull: false
    }
  }, {});
  XMRTransaction.associate = function(models) {
    XMRTransaction.belongsTo(models.Wallet, { foreignKey: 'wallet_id' });
    XMRTransaction.belongsTo(models.MoneroAddress, { foreignKey: 'monero_address_id' });
  };
  return XMRTransaction;
};