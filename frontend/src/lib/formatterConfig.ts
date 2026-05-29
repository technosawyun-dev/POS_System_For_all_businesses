interface FormatterConfig {
  currency: string
  locale: string
  timezone: string
}

let _config: FormatterConfig = {
  currency: 'MMK',
  locale: 'en-US',
  timezone: 'UTC',
}

export function setFormatterConfig(cfg: Partial<FormatterConfig>): void {
  _config = { ..._config, ...cfg }
}

export function getFormatterConfig(): Readonly<FormatterConfig> {
  return _config
}
