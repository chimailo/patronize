import Env from '@ioc:Adonis/Core/Env'
import Flutterwave from 'flutterwave-node-v3'
import open from 'open'
import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { rules, schema } from '@ioc:Adonis/Core/Validator'
import User from 'App/Models/User'
import Transaction from 'App/Models/Transaction'

const PUBLIC_KEY = Env.get('FLW_PUBLIC_KEY_TEST')
const SECRET_KEY = Env.get('FLW_SECRET_KEY_TEST')
const ENC_KEY = Env.get('FLW_ENCRYPTION_KEY_TEST')
const SECRET_HASH = Env.get('SECRET_HASH')

const flw = new Flutterwave(PUBLIC_KEY, SECRET_KEY)

const genRnStr = (len: number) =>
  [...Array(len)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')

export default class AccountsController {
  public async balance({ auth, response }: HttpContextContract) {
    try {
      const { balance } = await auth.authenticate()
      return response.status(200).send({
        status: 'success',
        message: 'Successfuly retrieved your balance',
        data: balance,
      })
    } catch {
      return response.internalServerError('A server error has occured, please try again.')
    }
  }

  public async initializeCard({ auth, request, response }: HttpContextContract) {
    // validate input
    const validationSchema = schema.create({
      amount: schema.string(),
      card_number: schema.string({}, [rules.maxLength(16)]),
      cvv: schema.string({}, [rules.maxLength(4)]),
      expiry_month: schema.string({}, [rules.maxLength(2)]),
      expiry_year: schema.string({}, [rules.maxLength(2)]),
      card_pin: schema.string({}, [rules.maxLength(4)]),
    })

    const input = await request.validate({
      schema: validationSchema,
    })

    const user = await auth.authenticate()
    const payload = {
      amount: input.amount,
      card_number: input.card_number,
      cvv: input.cvv,
      expiry_month: input.expiry_month,
      expiry_year: input.expiry_year,
      currency: 'NGN',
      email: user.email,
      phone: user.phone,
      fullname: `${user.firstName} ${user.lastName}`,
      client_ip: request.ip(),
      narration: 'Card Transaction',
      enckey: ENC_KEY,
      tx_ref: `CCREF_${[...Array(8)]
        .map(() => Math.floor(Math.random() * 16).toString(16))
        .join('')}`,
    }

    try {
      const res = await flw.Charge.card(payload)

      if (res.meta.authorization.mode === 'pin') {
        const newPayload = {
          ...payload,
          authorization: {
            mode: res.meta.authorization.mode,
            pin: input.card_pin,
          },
        }

        const recallCharge = await flw.Charge.card(newPayload)

        if (recallCharge.status === 'success') {
          await user.related('transactions').create({
            id: recallCharge.data.id,
            reference: recallCharge.data.tx_ref,
            currency: recallCharge.data.currency,
            amount: recallCharge.data.amount,
            status: recallCharge.data.status,
            narration: recallCharge.data.narration,
            type: 'Card Transaction',
          })
        }

        return response.status(200).send({
          status: 'success',
          message: `Successfuly initialiazed charge. ${recallCharge.data.processor_response}. Also use the 'flw_ref' key to validate this charge.`,
          data: recallCharge.data,
        })
      }

      if (res.meta.authorization.mode === 'redirect') {
        const url = res.meta.authorization.redirect
        open(url)
      }
    } catch (error) {
      console.log(error)
      return response.badGateway(error)
    }
  }

  public async bankTransfer({ auth, request, response }: HttpContextContract) {
    // validate input
    const validationSchema = schema.create({
      amount: schema.string(),
    })

    const { amount } = await request.validate({
      schema: validationSchema,
    })

    const user = await auth.authenticate()
    const payload = {
      amount,
      currency: 'NGN',
      email: user.email,
      phone_number: user.phone,
      fullname: `${user.firstName} ${user.lastName}`,
      client_ip: request.ip(),
      narration: 'Bank Transfer',
      enckey: ENC_KEY,
      is_permanent: true,
      tx_ref: `BTCREF_${[...Array(8)]
        .map(() => Math.floor(Math.random() * 16).toString(16))
        .join('')}`,
    }
    console.log(payload)

    try {
      const res = await flw.Charge.bank_transfer(payload)
      console.log(res)

      if (res.status === 'success') {
        await user.related('transactions').create({
          id: res.meta.authorization.id,
          reference: res.meta.authorization.transfer_reference,
          amount: res.meta.authorization.transfer_amount,
          currency: res.meta.currency,
          narration: res.meta.authorization.narration,
          status: 'success',
          type: 'Bank transfer',
        })
      }
      return res
    } catch (error) {
      console.log(error)
      return response.badGateway(error)
    }
  }

  public async validateCharge({ auth, request, response }: HttpContextContract) {
    const validationSchema = schema.create({
      otp: schema.string({}, [rules.maxLength(6)]),
      flw_ref: schema.string(),
    })

    const user = await auth.authenticate()
    const { flw_ref, otp } = await request.validate({
      schema: validationSchema,
    })

    try {
      const res = flw.Charge.validate({
        otp,
        flw_ref,
      })

      if (res.status === 'success') {
        await user.related('transactions').updateOrCreate(
          { id: res.data.id },
          {
            status: res.data.status,
          }
        )
      }
      return res
    } catch (error) {
      console.error(error)
      return response.badGateway(error)
    }
  }

  public async fundUser({ auth, request, response }: HttpContextContract) {
    // validate input
    const validationSchema = schema.create({
      email: schema.string({}, [rules.email(), rules.exists({ table: 'users', column: 'email' })]),
      amount: schema.number(),
      narration: schema.string.optional({}, [rules.maxLength(255)]),
    })

    const user = await auth.authenticate()
    const { amount, email, narration } = await request.validate({
      schema: validationSchema,
    })

    if (user.balance < amount) {
      return response.badRequest({
        status: 'failed',
        message: 'Insufficient balance',
        data: { balance: user.balance },
      })
    }

    try {
      const toUser = await User.findBy('email', email)
      await User.updateOrCreate({ id: user.id }, { balance: user.balance - amount })

      await User.updateOrCreate({ id: toUser?.id }, { balance: toUser!.balance + amount })

      await user.related('transactions').create({
        id: parseInt(Math.random().toString().slice(2, 7)),
        reference: `IATREF_${genRnStr(6)}`,
        amount: amount.toString(),
        currency: 'NGN',
        narration,
        status: 'successful',
        type: 'User in-app transfer',
        recipient: toUser?.id,
      })

      return {
        status: 'success',
        message: `Successfully transferred ${amount} to ${toUser?.firstName} ${toUser?.lastName}`,
        data: { balance: user.balance },
      }
    } catch (error) {
      return response.internalServerError({
        status: 'failed',
        message: `An unknown error has occured, please try again.`,
        data: null,
      })
    }
  }

  public async webhook({ request, response }: HttpContextContract) {
    /* It is a good idea to log all events received. Add code *
     * here to log the signature and body to db or file       */
    const hash = request.header('verif-hash')

    if (!hash) {
      // discard the request
    }
    console.log(hash)

    if (hash !== SECRET_HASH) {
      // silently exit your server.
      return
    }

    const body = request.body()

    try {
      if (body.event.type === 'CARD_TRANSACTION') {
        const res = await flw.Transaction.verify({ id: body.id })
        const trn = await Transaction.find(res.data.id)

        if (!trn) {
          return
        }

        if (res.data.tx_ref === trn.reference) {
          const user = await User.find(trn.userId)

          if (user) {
            if (
              res.data.currency === trn.currency &&
              parseInt(res.data.amount) >= parseInt(trn.amount) &&
              res.data.status.toLowerCase() === 'successful'
            ) {
              user.balance = user.balance + parseInt(trn.amount)
            }
            await user.save()
            await Transaction.updateOrCreate({ id: trn.id }, { status: res.data.status })
          }
        }
      }
      // if (body.event.type === 'transfer.completed') {
      const res = await flw.Transfer.get_a_transfer({ id: body.id })
      const trn = await Transaction.find(res.data.id)

      if (!trn) {
        return
      }

      if (res.data.tx_ref === trn.reference) {
        const user = await User.find(trn.userId)

        if (user) {
          if (res.data.status.toLowerCase() === 'successful') {
            user.balance = user.balance - parseInt(trn.amount)
          }
          await user.save()
          await Transaction.updateOrCreate({ id: trn.id }, { status: res.data.status })
        }
        // }
      }
    } catch (error) {
      console.log(error)
    }

    response.send(200)
  }
}
