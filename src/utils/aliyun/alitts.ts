import RPCClient from '@alicloud/pop-core';
import { nanoid } from 'nanoid';

const request = require('request-promise');

/**
 * 长语音合成参数
 */
export interface AliTtsOption {
  // https://help.aliyun.com/document_detail/130555.html
  appKey?: string;
  format?: string;
  sample_rate?: number;
  voice?: string;
  volume?: number;
  speech_rate?: number;
  pitch_rate?: number;
  enable_subtitle?: boolean;
  enable_notify?: boolean;
  notify_url?: string;
}

/**
 * 合成的返回数据定义
 */
export interface AliTtsComplete {
  task_id: string;
  audio_address: string;
  notify_custom: string;
  sentences: any;
}

class AliTTS {
  debug: boolean = false;

  /**
   *长文本合成请求URL
   *
   * @private
   * @type {string}
   * @memberof AliTTS
   */
  private ttsEndpoint: string =
    'https://nls-gateway.cn-shanghai.aliyuncs.com/rest/v1/tts/async';

  /**
   *应用Key
   *
   * @type {string}
   * @memberof AliTTS
   */
  appKey: string;

  /**
   *密钥配置
   *
   * @type {RPCClient.Config}
   * @memberof AliTTS
   */
  aliConfig: RPCClient.Config;

  /**
   *客户端
   *
   * @type {RPCClient}
   * @memberof AliTTS
   */
  client: RPCClient;

  token: string = '';

  tokenExpire: number =
    parseInt((new Date().getTime() / 1000).toString(), 10) - 10;

  constructor(
    appKey: string,
    aliConfig: RPCClient.Config,
    debug: boolean = false
  ) {
    this.aliConfig = aliConfig;
    this.appKey = appKey;
    this.debug = debug;
    this.client = new RPCClient(this.aliConfig);
  }

  log(...args): void {
    if (this.debug) {
      console.log('alitts debug:', ...args);
    }
  }

  /**
   * 获取token
   * @returns
   */
  getToken(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      if (
        this.token.length > 0
        && this.tokenExpire * 1000 > new Date().getTime()
      ) {
        resolve(this.token);
      } else {
        this.client
          .request('CreateToken', { Format: 'JSON' })
          .then((res: any) => {
            this.log('AliTTS CreateToken', res);
            if (res.ErrMsg === '') {
              this.tokenExpire = res.Token.ExpireTime;
              this.token = res.Token.Id;
              resolve(res.Token.Id);
            } else {
              this.log(res);
              reject(res);
            }
          })
          .catch((err) => {
            reject(err);
          });
      }
    });
  }

  /**
   * 开始转换任务，并获取任务ID
   * @param text 文本内容
   * @param options 转换选项
   * @returns
   */
  task(text: string, options?: AliTtsOption): Promise<string> {
    return new Promise<string>(async (resolve, reject) => {
      let _token = '';
      try {
        _token = await this.getToken();
      } catch (err) {
        reject(err);
        return;
      }

      const {
        appKey,
        format,
        sample_rate,
        voice,
        volume,
        speech_rate,
        pitch_rate,
        enable_subtitle,
        enable_notify,
        notify_url
      } = options || {};

      const requestConfig = {
        method: 'POST',
        uri: this.ttsEndpoint,
        json: true,
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          payload: {
            tts_request: {
              text,
              format: format || 'mp3',
              sample_rate: sample_rate || 16000,
              voice,
              volume,
              speech_rate,
              pitch_rate,
              enable_subtitle
            },
            enable_notify: enable_notify || false,
            notify_url
          },
          context: {
            device_id: nanoid()
          },
          header: {
            appkey: appKey || this.appKey,
            token: _token
          }
        }
      };
      this.log(requestConfig);

      request(requestConfig)
        .then((_rlt) => {
          this.log('task complete:', _rlt);

          if (_rlt.data.task_id) {
            resolve(_rlt.data.task_id);
          } else {
            reject(_rlt.data);
          }
        })
        .catch((_err) => {
          this.log('task error:', _err);
          reject(_err);
        });
    });
  }

  /**
   * 获取转换状态
   * @param taskId
   * @param appKey
   * @returns
   */
  status(taskId: string, appKey?: string): Promise<AliTtsComplete> {
    return new Promise<AliTtsComplete>(async (resolve, reject) => {
      let _token = '';
      try {
        _token = await this.getToken();
      } catch (err) {
        reject(err);
        return;
      }
      const _config = {
        method: 'GET',
        uri: `${this.ttsEndpoint}?appkey=${
          appKey || this.appKey
        }&task_id=${taskId}&token=${_token}`,
        json: true
      };

      request(_config)
        .then((rlt: any) => {
          this.log('task status:', rlt);
          resolve(rlt.data);
        })
        .catch((err) => {
          this.log('task status error:', err);
          reject(err);
        });
    });
  }

  /**
   * 同步完成转换
   * @param text 文字
   * @param options 转换配置
   * @param 轮训时间 秒
   */
  taskSync(
    text: string,
    interval: number = 3,
    options?: AliTtsOption
  ): Promise<AliTtsComplete> {
    return new Promise<AliTtsComplete>(async (resolve, reject) => {
      let taskId = '';
      try {
        taskId = await this.task(text, options);
      } catch (err) {
        this.log(err);
        reject(err);
      }

      const _interval = setInterval(async () => {
        try {
          const rlt: AliTtsComplete = await this.status(taskId);
          if (rlt.audio_address !== null && rlt.audio_address.length > 0) {
            clearInterval(_interval);
            resolve(rlt);
          }
        } catch (err) {
          clearInterval(_interval);
          this.log(err);
          reject(err);
        }
      }, interval * 1000);
    });
  }

  /**
   *检查配置
   * @returns
   */
  async checkConfig() {
    try {
      return (await this.taskSync('h', 2)).audio_address.length > 0;
    } catch (err) {
      console.error(err);
      return false;
    }
  }
}

export default AliTTS;