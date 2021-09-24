import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class Transaction extends BaseSchema {
  protected tableName = 'transactions'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.integer('id').primary()
      table.string('reference', 14).notNullable().unique()
      table.string('amount', 255).notNullable()
      table.string('status', 32).notNullable()
      table.string('narration', 255).notNullable()
      table.string('type', 32).notNullable()
      table.string('currency', 3).notNullable()
      table.integer('recipient')

      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
      // relations
      table.integer('user_id').notNullable()
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
