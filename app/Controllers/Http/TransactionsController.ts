import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

export default class TransactionsController {
  public async list({ auth, request, response }: HttpContextContract) {
    const user = await auth.authenticate()
    const page = request.input('page', 1)
    const limit = request.input('limit', 10)

    try {
      const transactions = await user
        .related('transactions')
        .query()
        .orderBy('createdAt', 'desc')
        .paginate(page, limit)
      return response.send({
        status: 'success',
        message: `Successfully retrieved your transactions`,
        data: transactions,
      })
    } catch (error) {
      console.log(error)
      return response.internalServerError({
        status: 'failed',
        message: 'An error has occured, please try again',
        data: null,
      })
    }
  }

  public async get({ auth, params, response }: HttpContextContract) {
    const user = await auth.authenticate()

    try {
      const transaction = await user.related('transactions').query().where('id', params.id).first()

      if (!transaction) {
        return response.status(404).send({
          status: 'failed',
          message: `You do not have any transaction with id = ${params.id}`,
          data: null,
        })
      }

      return response.send({
        status: 'success',
        message: `Successfully retrieved transaction with id = ${transaction.id}`,
        data: transaction,
      })
    } catch (error) {
      console.log(error)
      return response.internalServerError({
        status: 'failed',
        message: 'An error has occured, please try again',
        data: null,
      })
    }
  }
}
