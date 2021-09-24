import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class Beneficiary extends BaseSchema {
  protected tableName = 'beneficiaries'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.integer('id').primary()
      table.string('account_number', 16).notNullable()
      table.string('bank_code', 3).notNullable()
      table.string('bank_name', 150).notNullable()
      table.string('beneficiary_name', 255).notNullable()
      table.string('currency').notNullable().defaultTo('NGN')

      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
      // relations
      table.integer('user_id').notNullable().unsigned().references('users.id').onDelete('CASCADE')
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
