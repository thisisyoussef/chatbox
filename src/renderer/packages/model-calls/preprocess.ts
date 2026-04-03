import { getModel } from '@shared/models'
import { ChatboxAIAPIError } from '@shared/models/errors'
import { getModelSettings } from '@shared/utils/model_settings'
import type { ModelInterface } from '@shared/models/types'
import type { ModelMessage } from 'ai'
import pMap from 'p-map'
import { createModelDependencies } from '@/adapters'
import { settingsStore } from '@/stores/settingsStore'
import type { LangSmithTraceContext } from '../../../shared/utils/langsmith_adapter'
import { ModelProviderEnum, type Message } from '../../../shared/types'

const OCR_PROMPT =
  'OCR the following image into Markdown. Tables should be formatted as HTML. Do not sorround your output with triple backticks.'

const DRAWING_KIT_DESCRIPTION_PROMPT =
  'Describe this drawing canvas for another assistant. If the image includes both a full-board view and a zoomed focus view, use both. Focus only on the visible drawing itself: the main subject, notable shapes, colors, placement, stickers, and anything unclear or unfinished. Be factual, concise, and specific in 2 to 4 sentences. Do not invent hidden details or mention surrounding app chrome.'

async function createImageToTextModel() {
  const settings = settingsStore.getState().getSettings()
  const hasUserOcrModel = settings.ocrModel?.provider && settings.ocrModel?.model
  const hasLicenseKey = Boolean(settings.licenseKey)

  if (!hasUserOcrModel && !hasLicenseKey) {
    throw ChatboxAIAPIError.fromCodeName('model_not_support_image_2', 'model_not_support_image_2')
  }

  const dependencies = await createModelDependencies()
  if (hasUserOcrModel) {
    const ocrModelSetting = settings.ocrModel!
    const modelSettings = getModelSettings(settings, ocrModelSetting.provider, ocrModelSetting.model)
    return getModel(modelSettings, settings, { uuid: '123' }, dependencies)
  }

  const modelSettings = getModelSettings(settings, ModelProviderEnum.ChatboxAI, 'chatbox-ocr-1')
  return getModel(modelSettings, settings, { uuid: '123' }, dependencies)
}

export async function imageOCR(ocrModel: ModelInterface, messages: Message[], traceContext?: LangSmithTraceContext) {
  const dependencies = await createModelDependencies()

  return await pMap(messages, async (msg) => {
    await pMap(msg.contentParts, async (c) => {
      if (c.type === 'image' && !c.ocrResult) {
        const image = c
        const dataUrl = image.storageKey
        const imageData = await dependencies.storage.getImage(dataUrl)
        if (!imageData) {
          return c
        }
        const ocrResult = await doOCR(ocrModel, imageData, traceContext)
        image.ocrResult = ocrResult
        return c
      }
      return c
    })
    return msg
  })
}
async function doOCR(model: ModelInterface, imageData: string, traceContext?: LangSmithTraceContext) {
  return await runImageToTextPrompt(model, imageData, OCR_PROMPT, traceContext)
}

async function runImageToTextPrompt(
  model: ModelInterface,
  imageData: string,
  instruction: string,
  traceContext?: LangSmithTraceContext
) {
  const msg: ModelMessage = {
    role: 'user',
    content: [
      {
        type: 'text',
        text: instruction,
      },
      {
        type: 'image' as const,
        image: imageData,
        providerOptions: {
          openai: {
            imageDetail: 'high',
          },
        },
      },
    ],
  }
  const chatResult = await model.chat([msg], {
    traceContext,
  })
  const text = chatResult.contentParts
    .filter((p) => p.type === 'text')
    .map((p) => p.text)
    .join('')

  return text.trim()
}

export async function describeImageData(imageData: string, traceContext?: LangSmithTraceContext) {
  const model = await createImageToTextModel()
  return await runImageToTextPrompt(model, imageData, DRAWING_KIT_DESCRIPTION_PROMPT, traceContext)
}
