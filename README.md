# 校招测评练习题库

手机优先的纯静态 PWA。网页代码、处理后的题库分片和题图位于同一仓库；原始压缩包、PDF、DOC/DOCX 和临时导入文件不进入发布仓库。

线上地址：[yunzhixu620-stack.github.io/campus-question-bank-pwa](https://yunzhixu620-stack.github.io/campus-question-bank-pwa/)

开发或导题前先阅读 [PROJECT_RULES.md](PROJECT_RULES.md)。其中记录了题目准入、截图/OCR、每日计划、本地记忆、模拟考试、草稿纸、导入状态和发布检查的完整规则。

## 当前数据

- 总题数：5430
- 可普通练习：3232
- 待复核题：1710，不会进入随机练习、每日计划或模拟考试
- 整图资料：488，截图可能含答案标记，只用于搜索、浏览和收藏
- 数据分片：115 个，启动时仅加载目录和当前流程需要的分片
- 来源清单：`data/source-import-status.json`

不能把当前数据称为“全部导入完成”。扫描 PDF、旧 DOC、混合 PDF、疑似重复文件和答案外露文件都在来源清单中保留明确状态。

## 已有功能

- 按天分配题量；自由加练 30/40/50 题
- 随机、模块、套题层级筛选和搜索
- 上一题、下一题、答题卡、交卷结果
- 错题本、收藏、最近练习
- “不会 / 模糊 / 认识”三档间隔背题
- 不限时持续计时的 30 题模拟考试
- 白板草稿纸和四则运算计算器
- IndexedDB 本地记忆，支持 5 个本地用户档案
- 全用户进度 JSON 导出/导入
- Service Worker 离线外壳和按需题库缓存

## 验证与发布

```bash
node scripts/validate-project.mjs
node --check app.js
```

GitHub Actions 会先执行以上校验，成功后才部署 GitHub Pages。任何题目只要存在空选项、答案不对应、答案外露、目录/跨题污染、资源缺失或隔离状态不一致，发布都会失败。
