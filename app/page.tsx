'use client';

import React, { useState, useEffect } from 'react';
import Baobab from 'baobab';
import { TextInput, Button, Group, Box, Paper, Title, Popover, Collapse, Stack, ActionIcon, Textarea, useMantineColorScheme, useComputedColorScheme, Divider, Code } from '@mantine/core';
import { IconFilter, IconBrackets, IconBraces, IconPlus, IconChevronDown, IconChevronUp, IconTrash, IconSun, IconMoon, IconBinoculars } from '@tabler/icons-react';

// @ts-ignore
import jq from 'jq-web';

const initialTree = new Baobab([
  { type: 'filter', value: '.' },
]);

const TreeEditor = () => {
  const [tree] = useState(initialTree);
  const [nodeList, setNodeList] = useState(tree.get());
  const [newPropertyName, setNewPropertyName] = useState('');
  const [addingPropertyPath, setAddingPropertyPath] = useState<(string | number)[] | null>(null);
  const [resultExpression, setResultExpression] = useState('');
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [inputJSON, setInputJSON] = useState('');
  const [outputJSON, setOutputJSON] = useState('');
  const [selectedNodeExpression, setSelectedNodeExpression] = useState('');
  const [selectedNodePath, setSelectedNodePath] = useState<string | null>(null);

  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true });

  useEffect(() => {
    setResultExpression(generateResultExpression(nodeList));
  }, [nodeList]);

  useEffect(() => {
    refreshOutputJSON(resultExpression);
  }, [inputJSON, resultExpression]);

  const refreshOutputJSON = (expression: string) => {
    try {
      const parsedJSON = JSON.parse(inputJSON);
      executeJQExpression(parsedJSON, expression).then((result) => {
        setOutputJSON(JSON.stringify(result, null, 2));
      }).catch(() => {
        setOutputJSON('无效的JSON或表达式');
      });
    } catch (error) {
      setOutputJSON('无效的JSON或表达式');
    }
  };

  const generateResultExpression = (nodes: any[]): string => {
    const result = nodes.map((node) => {
      if (node.type === 'filter') {
        return node.value.trim();
      }
      if (node.type === 'array') {
        const innerValues = node.items
          .map((subList: any[]) => {
            const subListResult = generateResultExpression(subList);
            return subListResult.trim();
          })
          .filter((value: string) => value !== '')
          .join(', ');
        return innerValues ? `[${innerValues}]` : '';
      }
      if (node.type === 'object') {
        const innerValues = Object.entries(node.items)
          .map(([key, value]: [string, any]) => {
            const generatedValue = generateResultExpression(value);
            return generatedValue ? `${key}: ${generatedValue}` : '';
          })
          .filter(value => value !== '')
          .join(', ');
        return innerValues ? `{${innerValues}}` : '';
      }
      return '';
    })
      .filter(item => item !== '')
      .join(' | ');

    return result;
  };

  const executeJQExpression = async (data: any, expression: string): Promise<any> => {
    try {
      const result = jq.json(data, expression);
      return result;
    } catch (error) {
      // console.error(`执行jq表达式时出错, data: ${data}, expression: ${expression}, error: ${error}`);
      return null;
    }
  };

  const handleValueChange = (path: (string | number)[], newValue: string) => {
    tree.set(path.concat('value'), newValue);
    setNodeList(tree.get());
  };

  const handleAddNode = (path: (string | number)[], type: string) => {
    let newNode;
    switch (type) {
      case 'filter':
        newNode = { type: 'filter', value: '' };
        break;
      case 'array':
        newNode = { type: 'array', items: [] };
        break;
      case 'object':
        newNode = { type: 'object', items: {} };
        break;
    }

    const parentPath = path.slice(0, -1);
    const index = path[path.length - 1];
    const parentNode = tree.get(parentPath);

    if (Array.isArray(parentNode)) {
      tree.splice(parentPath, [Number(index) + 1, 0, newNode]);
    } else if (typeof parentNode === 'object' && parentNode.type === 'array' && Array.isArray(parentNode.items)) {
      tree.splice([...parentPath, 'items'], [Number(index) + 1, 0, newNode]);
    } else if (typeof parentNode === 'object' && parentNode.type === 'object' && typeof parentNode.items === 'object') {
      const newKey = `新属性${Object.keys(parentNode.items).length + 1}`;
      tree.set([...parentPath, 'items', newKey], [newNode]);
    } else {
      // console.error('无法添加节点：父节点结构不正确');
      return;
    }
    setNodeList(tree.get());
  };

  const handleAddNewList = (path: (string | number)[]) => {
    tree.push(path, [{ type: 'filter', value: '' }]);
    setNodeList(tree.get());
  };

  const handleDeleteNode = (path: (string | number)[]) => {
    tree.unset(path);
    setNodeList(tree.get());
  };

  const handleDeleteNodeList = (path: (string | number)[]) => {
    const parentPath = path.slice(0, -1);
    const index = path[path.length - 1];
    const parentNode = tree.get(parentPath);

    if (Array.isArray(parentNode)) {
      const newArray = [...parentNode];
      newArray.splice(Number(index), 1);
      tree.set(parentPath, newArray);
    } else if (typeof parentNode === 'object') {
      const { [index as string]: deletedProperty, ...rest } = parentNode;
      tree.set(parentPath, rest);
    }

    setNodeList(tree.get());
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'filter':
        return <IconFilter size={14} />;
      case 'array':
        return <IconBrackets size={14} />;
      case 'object':
        return <IconBraces size={14} />;
      default:
        return null;
    }
  };

  const toggleCollapse = (path: (string | number)[]) => {
    const pathString = path.join('-');
    setCollapsedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(pathString)) {
        newSet.delete(pathString);
      } else {
        newSet.add(pathString);
      }
      return newSet;
    });
  };

  const buildTrimmedTree = (originalTree: any[], selectedPath: (string | number)[]): any[] => {
    const result: any[] = [];
    let currentLevel = result;
    const parentStack: any[] = [];

    for (let i = 0; i < selectedPath.length; i++) {
      const pathPart = selectedPath[i];
      const node = originalTree[pathPart as number];

      if (i === selectedPath.length - 1) {
        // 最后一个节点，直接添加
        currentLevel.push(node);
      } else {
        // 中间节点，创建新的容器
        const newContainer: any = { ...node, items: Array.isArray(node.items) ? [] : {} };
        currentLevel.push(newContainer);
        parentStack.push(currentLevel);
        currentLevel = newContainer.items;
      }
    }

    return result;
  };

  const handleNodeSelect = (path: (string | number)[]) => {
    const pathString = path.join('-');
    if (selectedNodePath === pathString) {
      // 如果当前节点已经被选中，则取消选中
      setSelectedNodePath(null);
      setSelectedNodeExpression('');
      setNodeList(tree.get());
      refreshOutputJSON(resultExpression);
    } else {
      // 选中新节点
      setSelectedNodePath(pathString);
      const trimmedTree = buildTrimmedTree(nodeList, path);
      const expression = generateResultExpression(trimmedTree);
      setSelectedNodeExpression(expression);
      refreshOutputJSON(expression);
    }
  };

  const renderNode = (node: any, path: (string | number)[] = [], depth = 0) => {
    const nodeType = node.type;
    const displayValue = generateResultExpression([node]);
    const pathString = path.join('-');
    const isCollapsed = collapsedNodes.has(pathString);
    const isSelected = selectedNodePath === pathString;

    return (
      <Paper key={pathString} shadow="xs" p="xs" ml={depth * 20}>
        <Group gap="xs" wrap="nowrap">
          {getNodeIcon(nodeType)}
          {(nodeType === 'array' || nodeType === 'object') && (
            <Button variant="subtle" size="xs" onClick={() => toggleCollapse(path)}>
              {isCollapsed ? <IconChevronDown size={14} /> : <IconChevronUp size={14} />}
            </Button>
          )}
          <TextInput
            size="xs"
            value={displayValue}
            onChange={(e) => handleValueChange(path, e.target.value)}
            disabled={nodeType === 'array' || nodeType === 'object'}
            style={{ flexGrow: 1 }}
          />
          <Popover position="bottom" withArrow shadow="md">
            <Popover.Target>
              <ActionIcon variant="light" size="sm">
                <IconPlus size={14} />
              </ActionIcon>
            </Popover.Target>
            <Popover.Dropdown>
              <Group gap="xs">
                <Button variant="light" size="xs" onClick={() => handleAddNode(path, 'filter')}>
                  添加过滤器
                </Button>
                <Button variant="light" size="xs" onClick={() => handleAddNode(path, 'array')}>
                  添加数组
                </Button>
                <Button variant="light" size="xs" onClick={() => handleAddNode(path, 'object')}>
                  添加对象
                </Button>
              </Group>
            </Popover.Dropdown>
          </Popover>
          <ActionIcon variant="light" size="sm" onClick={() => handleDeleteNode(path)}>
            <IconTrash size={14} />
          </ActionIcon>
          <ActionIcon
            variant={isSelected ? 'filled' : 'light'}
            size="sm"
            onClick={() => handleNodeSelect(path)}
            color={isSelected ? 'blue' : 'gray'}
          >
            <IconBinoculars size={14} />
          </ActionIcon>
        </Group>

        <Collapse in={!isCollapsed}>
          {nodeType === 'array' && (
            <Box mt="xs">
              <Stack gap="xs">
                {node.items && node.items.map((subList: any, index: number) => (
                  <Paper key={index} shadow="xs" p="xs">

                    <Group gap="xs" pb="xs" wrap="nowrap" justify="space-between">
                      <Title order={6}>列表 {index + 1}</Title>
                      <ActionIcon variant="light" size="sm" onClick={() => handleDeleteNodeList(path.concat('items', index))}>
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Group>
                    <Stack gap="xs">
                      {Array.isArray(subList) && subList.map((childNode: any, childIndex: number) =>
                        renderNode(childNode, path.concat('items', index, childIndex), depth + 1)
                      )}
                    </Stack>
                    {subList.length === 0 &&
                      <Popover position="bottom" withArrow shadow="md">
                        <Popover.Target>
                          <Button variant="light" size="xs" mt="xs">
                            添加
                          </Button>
                        </Popover.Target>
                        <Popover.Dropdown>
                          <Group gap="xs">
                            <Button variant="light" size="xs" onClick={() => handleAddNode(path.concat('items', index, 0), 'filter')}>
                              添加过滤器
                            </Button>
                            <Button variant="light" size="xs" onClick={() => handleAddNode(path.concat('items', index, 0), 'array')}>
                              添加数组
                            </Button>
                            <Button variant="light" size="xs" onClick={() => handleAddNode(path.concat('items', index, 0), 'object')}>
                              添加对象
                            </Button>
                          </Group>
                        </Popover.Dropdown>
                      </Popover>
                    }
                  </Paper>
                ))}
              </Stack>
              <Button variant="light" size="xs" mt="xs" onClick={() => handleAddNewList(path.concat('items'))}>
                添加新列表
              </Button>
            </Box>
          )}
          {nodeType === 'object' && (
            <Box mt="xs">
              <Stack gap="xs">
                {node.items && Object.entries(node.items).map(([key, subList]: [string, any]) => (
                  <Paper key={key} shadow="xs" p="xs">
                    <Group gap="xs" wrap="nowrap" justify="space-between">
                      <Title order={6}>{key}</Title>
                      <ActionIcon variant="light" size="sm" onClick={() => handleDeleteNodeList(path.concat('items', key))}>
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Group>
                    <Stack gap="xs">
                      {Array.isArray(subList) && subList.map((childNode: any, index: number) =>
                        renderNode(childNode, path.concat('items', key, index), depth + 1)
                      )}
                    </Stack>
                    {Array.isArray(subList) && subList.length === 0 &&
                      <Popover position="bottom" withArrow shadow="md">
                        <Popover.Target>
                          <Button variant="light" size="xs" mt="xs">
                            添加
                          </Button>
                        </Popover.Target>
                        <Popover.Dropdown>
                          <Group gap="xs">
                            <Button variant="light" size="xs" onClick={() => handleAddNode(path.concat('items', key, 0), 'filter')}>
                              添加过滤器
                            </Button>
                            <Button variant="light" size="xs" onClick={() => handleAddNode(path.concat('items', key, 0), 'array')}>
                              添加数组
                            </Button>
                            <Button variant="light" size="xs" onClick={() => handleAddNode(path.concat('items', key, 0), 'object')}>
                              添加对象
                            </Button>
                          </Group>
                        </Popover.Dropdown>
                      </Popover>
                    }
                  </Paper>
                ))}
              </Stack>
              <Popover
                opened={addingPropertyPath !== null && addingPropertyPath.join('-') === path.join('-')}
                onClose={() => setAddingPropertyPath(null)}
                position="bottom"
                withArrow
                shadow="md"
              >
                <Popover.Target>
                  <Button variant="light" size="xs" mt="xs" onClick={() => setAddingPropertyPath(path)}>
                    添加新属性
                  </Button>
                </Popover.Target>
                <Popover.Dropdown>
                  <Group gap="xs" wrap="nowrap">
                    <TextInput
                      size="xs"
                      placeholder="输入属性名"
                      value={newPropertyName}
                      onChange={(e) => setNewPropertyName(e.target.value)}
                      style={{ flexGrow: 1 }}
                    />
                    <Button
                      size="xs"
                      onClick={() => {
                        if (newPropertyName) {
                          tree.set([...path, 'items', newPropertyName], [{ type: 'filter', value: '' }]);
                          setNodeList(tree.get());
                          setNewPropertyName('');
                          setAddingPropertyPath(null);
                        }
                      }}
                    >
                      确定
                    </Button>
                  </Group>
                </Popover.Dropdown>
              </Popover>
            </Box>
          )}
        </Collapse>
      </Paper>
    );
  };

  return (
    <>
       <Box>
          <Group justify="space-between" p="xs">
            <Title pl={10} order={3}>jq generator</Title>
            <ActionIcon
              onClick={() => setColorScheme(computedColorScheme === 'light' ? 'dark' : 'light')}
              variant="default"
              size="lg"
              aria-label="切换主题"
            >
              {computedColorScheme === 'dark' ? <IconSun size="1.2rem" /> : <IconMoon size="1.2rem" />}
            </ActionIcon>
          </Group>
          <Divider />

          <Box p="xs" style={{ width: '80%', margin: '0 auto' }}>
            <Group grow align="flex-start">
              <Box>
                <Textarea
                  label="输入JSON"
                  placeholder="请输入JSON数据"
                  rows={15}
                  mb="md"
                  onChange={(e) => setInputJSON(e.target.value)}
                />
              </Box>
              <Box>
                <Textarea
                  label="输出结果"
                  value={outputJSON}
                  readOnly
                  rows={15}
                  mb="md"
                />
              </Box>
            </Group>
            <Paper shadow="xs" p="xs" mb="xs">
              <Title order={6}>结果表达式：</Title>
              <Code block>{resultExpression || '请在下方输入表达式'}</Code>
            </Paper>
            <Paper shadow="xs" p="xs" mb="xs">
                <Title order={6}>选中节点表达式：</Title>
                <Code block>{selectedNodeExpression || '未选中节点'}</Code>
            </Paper>

            <Stack gap="xs">
              {nodeList.map((node: any, index: number) => renderNode(node, [index]))}
            </Stack>
            {nodeList.length === 0 && (
              <Group gap="xs" mt="xs">
                <Button variant="light" size="xs" onClick={() => handleAddNode([], 'filter')}>
                  添加过滤器
                </Button>
                <Button variant="light" size="xs" onClick={() => handleAddNode([], 'array')}>
                  添加数组
                </Button>
                <Button variant="light" size="xs" onClick={() => handleAddNode([], 'object')}>
                  添加对象
                </Button>
              </Group>
            )}
          </Box>
       </Box>
    </>

  );
};

export default TreeEditor;
