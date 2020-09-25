'use strict';
module.exports = (sequelize, DataTypes) => {
  const BitcoinAddress = sequelize.define('BitcoinAddress', {
    wallet_id: {
      type: DataTypes.UUID,
      references: {
        model: 'Wallets',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      allowNull: false
    },
    seg_wit_address: {
      type: DataTypes.STRING,
      allowNull: false
    },
    balance: {
      type: DataTypes.DECIMAL,
      defaultValue: 0.0
    },
    redeem_script: {
      type: DataTypes.STRING,
      allowNull: false
    },
    private_key: {
      type: DataTypes.STRING,
      allowNull: false
    },
    public_key: {
      type: DataTypes.STRING,
      allowNull: false
    },
    wif: {
      type: DataTypes.STRING,
      allowNull: false
    },
    address: {
      type: DataTypes.STRING,
      allowNull: false
    },
    coin_type: {
      type: DataTypes.STRING,
      allowNull: false
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
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
    compressed: {
      type: DataTypes.BOOLEAN
    },
    released: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {  });
  BitcoinAddress.associate = function(models) {
    BitcoinAddress.belongsTo(models.Wallet, { foreignKey: 'wallet_id' });
  };
  return BitcoinAddress;
};
