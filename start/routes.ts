/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
|
| This file is dedicated for defining HTTP routes. A single file is enough
| for majority of projects, however you can define routes in different
| files and just make sure to import them inside this file. For example
|
| Define routes in following two files
| ├── start/routes/cart.ts
| ├── start/routes/customer.ts
|
| and then import them inside `start/routes.ts` as follows
|
| import './routes/cart'
| import './routes/customer'
|
*/

import HealthCheck from '@ioc:Adonis/Core/HealthCheck'
import Route from '@ioc:Adonis/Core/Route'

Route.get('/', async () => {
  return { hello: 'world' }
})

Route.group(() => {
  Route.post('register', 'AuthController.register').as('register')
  Route.post('login', 'AuthController.login').as('login')
  Route.post('logout', 'AuthController.logout').as('logout').middleware('auth:api')
}).prefix('api/auth/')

Route.group(() => {
  Route.group(() => {
    Route.get('', 'UsersController.get')
    Route.put('', 'UsersController.update')
    Route.delete('', 'UsersController.delete')
  }).prefix('api/user/')
}).middleware('auth:api')

Route.group(() => {
  Route.post('webhook', 'AccountsController.webhook')
  Route.group(() => {
    Route.get('balance', 'AccountsController.balance')
    Route.post('initialize-card', 'AccountsController.initializeCard')
    Route.post('validate-charge', 'AccountsController.validateCharge')
    Route.post('bank-transfer', 'AccountsController.bankTransfer')
    Route.post('transfer', 'AccountsController.fundUser')
  }).middleware('auth:api')
}).prefix('api/accounts/')

Route.group(() => {
  Route.group(() => {
    Route.get('', 'BeneficiaryController.list')
    Route.post('', 'BeneficiaryController.create')
    Route.get(':id', 'BeneficiaryController.get')
    Route.post(':id/withdraw', 'BeneficiaryController.withdraw')
    Route.delete(':id', 'BeneficiaryController.delete')
  }).prefix('api/beneficiaries/')

  Route.group(() => {
    Route.get('', 'TransactionsController.list')
    Route.get(':id', 'TransactionsController.get')
  }).prefix('api/transactions/')
}).middleware('auth:api')

// check db connection
Route.get('health', async ({ response }) => {
  const report = await HealthCheck.getReport()

  return report.healthy ? response.ok(report) : response.badRequest(report)
})
