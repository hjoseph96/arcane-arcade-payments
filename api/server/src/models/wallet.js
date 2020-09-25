'use strict';
module.exports = (sequelize, DataTypes) => {
  const Wallet = sequelize.define('Wallet', {
    id: {
      type:DataTypes.UUID,
      allowNull:false,
      unique:true,
      primaryKey:true,
      defaultValue: DataTypes.UUIDV4
    },
    btc_balance: {
      type:DataTypes.DECIMAL,
      allowNull: false,
      defaultValue: 0.00
    },
    ltc_balance: {
      type:DataTypes.DECIMAL,
      allowNull: false,
      defaultValue: 0.00
    },
    xmr_balance: {
      type:DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0.00
    },
    user_id: {
      type: DataTypes.INTEGER,
      unique: true,
      allowNull: true
    }
  }, {
  });
  Wallet.associate = function(models) {
    Wallet.hasMany(models.BitcoinAddress, { foreignKey: 'wallet_id' });
    Wallet.hasMany(models.BTCTransaction, { foreignKey: 'wallet_id' });
    Wallet.hasMany(models.MoneroAddress, { foreignKey: 'wallet_id' });
    Wallet.hasMany(models.XMRTransaction, { foreignKey: 'wallet_id' });
  };
  return Wallet;
};
