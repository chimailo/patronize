import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { rules, schema } from '@ioc:Adonis/Core/Validator'
import User from 'App/Models/User'

export default class AuthController {
  public async login({ request, auth, response }: HttpContextContract) {
    const email = request.input('email')
    const password = request.input('password')

    try {
      const token = await auth.use('api').attempt(email, password, {
        expiresIn: '24hours',
      })
      return token.toJSON()
    } catch (error) {
      console.log(error)
      return response.badRequest('Invalid credentials')
    }
  }

  public async register({ request, auth, response }: HttpContextContract) {
    // validate input
    const validationSchema = schema.create({
      email: schema.string({ trim: true }, [
        rules.email(),
        rules.unique({ table: 'users', column: 'email' }),
      ]),
      password: schema.string({ trim: true }, [rules.confirmed(), rules.minLength(6)]),
      phone: schema.string({ trim: true }, [rules.maxLength(14)]),
      firstName: schema.string({ trim: true }, [rules.maxLength(64)]),
      lastName: schema.string({ trim: true }, [rules.maxLength(64)]),
    })

    const data = await request.validate({
      schema: validationSchema,
    })

    try {
      const user = await User.create(data)
      const token = await auth.use('api').login(user, {
        expiresIn: '24hours',
      })
      return token.toJSON()
    } catch (error) {
      console.log(error)
      return response.internalServerError('A server error has occured, please try again.')
    }
  }

  public async logout({ auth, response }: HttpContextContract) {
    try {
      await auth.logout()
      return response.status(200).send({
        status: 'success',
        message: 'Successfuly logged out',
        data: null,
      })
    } catch (error) {
      console.log(error)
      return response.internalServerError('A server error has occured, please try again.')
    }
  }
}
