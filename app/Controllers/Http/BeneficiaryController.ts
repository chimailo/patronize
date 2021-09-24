import Env from '@ioc:Adonis/Core/Env'
import Flutterwave from 'flutterwave-node-v3'
import Logger from '@ioc:Adonis/Core/Logger'
import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { rules, schema } from '@ioc:Adonis/Core/Validator'
import Beneficiary from 'App/Models/Beneficiary'

const PUBLIC_KEY = Env.get('FLW_PUBLIC_KEY_TEST')
const SECRET_KEY = Env.get('FLW_SECRET_KEY_TEST')

const flw = new Flutterwave(PUBLIC_KEY, SECRET_KEY)

export default class BeneficiaryController {
  public async create({ auth, request, response }: HttpContextContract) {
    // validate input
    const validationSchema = schema.create({
      accountNumber: schema.string(),
      bankCode: schema.string({}, [rules.maxLength(3)]),
      bankName: schema.string.optional({ trim: true }, [rules.maxLength(150)]),
      beneficiaryName: schema.string({}, [rules.maxLength(64)]),
      currency: schema.string.optional({}, [rules.maxLength(3)]),
    })

    const input = await request.validate({
      schema: validationSchema,
    })

    const payload = {
      account_number: input.accountNumber,
      account_bank: input.bankCode,
      bank_name: input.bankName,
      beneficiary_name: input.beneficiaryName,
      currency: input.currency || 'NGN',
    }

    const user = await auth.authenticate()
    const beneficiary = new Beneficiary()

    try {
      const res = await flw.Beneficiary.create(payload)

      if (res.status === 'success') {
        console.log(res)
        beneficiary.id = res.data.id
        beneficiary.accountNumber = res.data.account_number
        beneficiary.bankCode = res.data.bank_code
        beneficiary.bankName = res.data.bank_name
        beneficiary.beneficiaryName = res.data.full_name
        beneficiary.currency = request.input('currency', 'NGN')

        await user.related('beneficiaries').save(beneficiary)
        Logger.info({ BeneficiaryId: beneficiary.id }, res.message)
      }
      return response.status(201).send(res)
    } catch (error) {
      console.log(error)
      Logger.info({ Beneficiary: beneficiary }, `Beneficiary not created`)
      return response.internalServerError(error.message)
    }
  }

  public async list({ auth, request, response }: HttpContextContract) {
    const user = await auth.authenticate()
    const page = request.input('page', 1)
    const limit = request.input('limit', 10)

    try {
      const beneficiaries = await user
        .related('beneficiaries')
        .query()
        .orderBy('createdAt', 'desc')
        .paginate(page, limit)
      return response.send({
        status: 'success',
        message: `Successfully retrieved your beneficiaries.`,
        data: beneficiaries,
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
      const beneficiary = await user.related('beneficiaries').query().where('id', params.id).first()

      if (!beneficiary) {
        return response.status(404).send({
          status: 'failed',
          message: `You do not have any beneficiary with id = ${params.id}`,
          data: null,
        })
      }

      return response.send({
        status: 'success',
        message: `Successfully retrieved beneficiary with id: ${beneficiary.id}`,
        data: beneficiary,
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

  public async withdraw({ auth, params, request, response }: HttpContextContract) {
    // validate input
    const validationSchema = schema.create({
      amount: schema.string(),
    })

    const user = await auth.authenticate()
    const beneficiaryId = request.params().id

    const { amount } = await request.validate({
      schema: validationSchema,
    })

    if (user.balance < parseInt(amount)) {
      return response.badRequest({
        status: 'failed',
        message: 'Insufficient balance',
        data: { balance: user.balance },
      })
    }

    const beneficiary = await user
      .related('beneficiaries')
      .query()
      .where('id', beneficiaryId)
      .first()

    if (!beneficiary) {
      return response.status(404).send({
        status: 'failed',
        message: `You do not have any beneficiary with the supplied id.`,
        data: beneficiary,
      })
    }

    const payload = {
      amount,
      account_bank: beneficiary.bankCode,
      account_number: beneficiary.accountNumber,
      currency: beneficiary.currency,
      narration: request.input('narration', ''),
      beneficiary_name: request.input('beneficiaryName', `${beneficiary.beneficiaryName}`),
      reference: `BWREF_${[...Array(8)]
        .map(() => Math.floor(Math.random() * 16).toString(16))
        .join('')}`,
      meta: {
        first_name: user.firstName,
        last_name: user.lastName,
        email: user.email,
        mobile_number: user.phone,
      },
    }

    // try {
    const res = await flw.Transfer.initiate(payload)

    if (res.status === 'success') {
      await user.related('transactions').create({
        id: res.data.id,
        reference: res.data.reference,
        amount: res.data.amount,
        status: res.data.status,
        currency: beneficiary.currency,
        narration: res.data.narration,
        type: 'Withdrawal',
        recipient: beneficiary.id,
      })
    }
    return res
    // } catch (error) {
    //   return response.internalServerError({
    //     status: 'failed',
    //     message: 'An error has occured, please try again',
    //     data: null,
    //   })
    // }
  }

  public async delete({ auth, params, response }: HttpContextContract) {
    const user = await auth.authenticate()

    try {
      const beneficiary = await user.related('beneficiaries').query().where('id', params.id).first()

      if (!beneficiary) {
        return response.status(404).send({
          status: 'failed',
          message: `You do not have any beneficiary with id = ${params.id}`,
          data: null,
        })
      }

      const res = await flw.Beneficiary.delete({ id: beneficiary.id.toString() })

      if (res.status === 'success') {
        await beneficiary.delete()
      }
      return res
    } catch (error) {
      console.log(error.message)
      return response.internalServerError({
        status: 'failed',
        message: 'An error has occured, please try again',
        data: null,
      })
    }
  }
}
