import {BrowserRouter} from "react-router-dom";
import {RoutesContainer} from "./models/RoutesContainer";
import React from "react";
import {Layout, ConfigProvider, theme} from "antd";
import {Content, Header} from "antd/es/layout/layout";
import {HorizontalBar} from "./models/HorizontalBar";
import { DefaultFooter } from '@ant-design/pro-components';
import { GithubOutlined } from '@ant-design/icons';

export function App(props) {
    return (
        <ConfigProvider
            theme={{
                algorithm: theme.darkAlgorithm,
                token: {
                    // 自定义深色主题的token
                    colorBgContainer: 'rgba(30, 30, 30, 0.9)',
                    colorBgElevated: 'rgba(40, 40, 40, 0.9)',
                    colorBorder: '#404040',
                    colorText: '#ffffff',
                    colorTextSecondary: 'rgba(255, 255, 255, 0.7)',
                    colorTextTertiary: 'rgba(255, 255, 255, 0.5)',
                    colorFill: 'rgba(255, 255, 255, 0.1)',
                    colorFillSecondary: 'rgba(255, 255, 255, 0.05)',
                    colorFillTertiary: 'rgba(255, 255, 255, 0.02)',
                    colorPrimary: '#1890ff',
                    colorPrimaryHover: '#40a9ff',
                    colorPrimaryActive: '#096dd9',
                    borderRadius: 6,
                },
                components: {
                    Card: {
                        colorBgContainer: 'rgba(30, 30, 30, 0.9)',
                        colorBorderSecondary: '#404040',
                    },
                    Input: {
                        colorBgContainer: 'rgba(50, 50, 50, 0.9)',
                        colorBorder: '#404040',
                        colorText: '#ffffff',
                    },
                    Select: {
                        colorBgContainer: 'rgba(50, 50, 50, 0.9)',
                        colorBorder: '#404040',
                        colorText: '#ffffff',
                    },
                    Button: {
                        colorBgContainer: 'rgba(50, 50, 50, 0.9)',
                        colorBorder: '#404040',
                        colorText: '#ffffff',
                    },
                    Table: {
                        colorBgContainer: 'rgba(30, 30, 30, 0.9)',
                        colorBorderSecondary: '#404040',
                        colorText: '#ffffff',
                    },
                    Modal: {
                        colorBgElevated: 'rgba(30, 30, 30, 0.95)',
                        colorBorder: '#404040',
                        colorText: '#ffffff',
                    },
                },
            }}
        >
            <BrowserRouter>
                <Layout>
                    {/*后续可以添加回来这个东西*/}
                    {/*<Header>*/}
                    {/*    <HorizontalBar/>*/}
                    {/*</Header>*/}
                    <Content>
                        <RoutesContainer>
                        </RoutesContainer>
                    </Content>
                </Layout>
                {/*后续可以添加回来这个东西*/}
                {/* <DefaultFooter
                    style={{height: "50px",
                    backgroundColor: "#fff",}}
                    copyright="@2024 zeusnet"
                    links={[
                        {
                            key: 'zeusnet topology simulation',
                            title: 'zeusnet topology simulation',
                            href: 'https://github.com/zhanghefan123',
                            blankTarget: true,
                        },
                        {
                            key: 'github',
                            title: <GithubOutlined />,
                            href: 'https://github.com/ant-design/ant-design-pro',
                            blankTarget: true,
                        },
                        {
                            key: 'zeusnet',
                            title: 'zeusnet',
                            href: 'https://github.com/zhanghefan123',
                            blankTarget: true,
                        },
                    ]}
                /> */}
            </BrowserRouter>
        </ConfigProvider>
    )
}