import { useState, useEffect } from 'react';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/lib/locale/zh_CN';
import Index from './layout';
import { AppContext, appSetting, appSettingCacheKey } from '@/config';
import { appReset } from '@/utils/core';

appReset();

export default () => {
  const [setting, setSetting] = useState(appSetting);

  const updateConfig = (newSetting: {
    [T in keyof APP.AppSetting]?: APP.AppSetting[T];
  }) => {
    setSetting({ ...setting, ...newSetting });
  };

  useEffect(() => {
    localStorage.setItem(appSettingCacheKey, JSON.stringify(setting));
  }, [setting]);

  return (
    <ConfigProvider direction="ltr" locale={zhCN}>
      <AppContext.Provider
        value={{ appSetting: setting, setAppSetting: updateConfig }}
      >
        <Index />
      </AppContext.Provider>
    </ConfigProvider>
  );
};
