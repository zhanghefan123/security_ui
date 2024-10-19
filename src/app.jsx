import {BrowserRouter} from "react-router-dom";
import {RoutesContainer} from "./models/RoutesContainer";
import React from "react";
import {Layout} from "antd";
import {Content, Header} from "antd/es/layout/layout";
import {HorizontalBar} from "./models/HorizontalBar";
import { DefaultFooter } from '@ant-design/pro-components';
import { GithubOutlined } from '@ant-design/icons';

export function App(props) {
    return (
        <BrowserRouter>
            <Layout>
                <Header>
                    <HorizontalBar/>
                </Header>
                <Content>
                    <RoutesContainer>
                    </RoutesContainer>
                </Content>
            </Layout>
            <DefaultFooter
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
            />
        </BrowserRouter>
    )
}