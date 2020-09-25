'use strict';
module.exports = (sequelize, DataTypes) => {
  const BTCTransaction = sequelize.define('BTCTransaction', {
    id: {
      type:DataTypes.UUID,
      allowNull:false,
      unique:true,
      primaryKey:true,
      defaultValue: DataTypes.UUIDV4
    },
    payment_outputs: {
      type: DataTypes.ARRAY(DataTypes.JSONB),
      allowNull: false
    },
    payment_inputs: {
      type: DataTypes.ARRAY(DataTypes.JSONB),
      allowNull: false
    },
    raw_transaction: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    transaction_id: {
      type: DataTypes.TEXT,
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
      allowNull: false
    }
  }, {});
  BTCTransaction.associate = function(models) {
    BTCTransaction.belongsTo(models.Wallet, { foreignKey: 'wallet_id' });
  };
  return BTCTransaction;
};