'use strict';

const db = require('../src/models/db');
const crypto = require('crypto');

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('Starting API Key backfill...');
    
    try {
      // Ensure DB connection is established if not already
      if (!db.sequelize.connectionManager.hasOwnProperty('pool')) {
         await db.sequelize.authenticate();
      }

      // Fetch all users
      const users = await db.users.findAll();
      
      for (const user of users) {
          // Get attributes for user
          const userAttrs = await db.user_attributes.findAll({
              where: { user_id: user.id },
              include: [{ model: db.attributes, as: 'attribute' }]
          });
          
          let role = 'customer'; // Default role if not specified
          let hasApiKey = false;
          
          // Check attributes
          for (const ua of userAttrs) {
              if (ua.attribute && ua.attribute.slug === 'role') {
                  role = ua.value;
              }
              if (ua.attribute && ua.attribute.slug === 'api_key') {
                  hasApiKey = true;
              }
          }
          
          // Generate key if role is customer and they don't have one
          if (role === 'customer' && !hasApiKey) {
              console.log(`Generating API Key for user ${user.email} (ID: ${user.id})...`);
              
              // Get or create api_key attribute definition
              let apiKeyAttr = await db.attributes.findOne({ where: { slug: 'api_key' } });
              if (!apiKeyAttr) {
                  apiKeyAttr = await db.attributes.create({ name: 'api key', slug: 'api_key' });
              }
              
              // Create user attribute
              const apiKey = `OBN-${crypto.randomBytes(20).toString('hex')}`;
              await db.user_attributes.create({
                  user_id: user.id,
                  attribute_id: apiKeyAttr.id,
                  value: apiKey
              });
          }
      }
      console.log('Backfill completed successfully.');
    } catch (error) {
      console.error('Backfill failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    // No rollback action for API key generation to prevent data loss
  }
};