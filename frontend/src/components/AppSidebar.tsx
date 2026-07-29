import { useEffect, useState } from 'react'
import {
  Box,
  Drawer,
  Toolbar,
  Typography,
  IconButton,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Tooltip,
  Divider,
  Stack,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import LightModeIcon from '@mui/icons-material/LightMode'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import { useAppState } from '../context/AppContext'
import { useColorMode } from '../context/ColorModeContext'
import { deleteThread, getThreadMessages, renameThread } from '../api/backend'
import type { AppAction } from '../context/reducer'
import { normalizeError } from '../utils/errorMessage'

const EXPANDED_WIDTH = 272
const COLLAPSED_WIDTH = 68

export default function AppSidebar() {
  const { state, dispatch } = useAppState()
  const { mode, toggleMode } = useColorMode()
  const [collapsed, setCollapsed] = useState(false)

  const handleNewChat = () => {
    dispatch({ type: 'CLEAR_ACTIVE_THREAD' } as AppAction)
  }

  const handleSelectThread = async (threadId: string) => {
    if (threadId === state.activeThreadId) return
    try {
      const detail = await getThreadMessages(threadId)
      dispatch({
        type: 'SET_ACTIVE_THREAD_DATA',
        payload: { threadId: detail.threadId, schema: detail.schema, messages: detail.messages },
      } as AppAction)
    } catch (err) {
      console.error('Failed to load thread:', normalizeError(err, 'Failed to load chat.').message)
    }
  }

  const handleDeleteThread = async (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await deleteThread(threadId)
      dispatch({ type: 'REMOVE_THREAD', payload: threadId } as AppAction)
    } catch (err) {
      console.error('Failed to delete thread:', normalizeError(err, 'Failed to delete chat.').message)
    }
  }

  const handleEditThread = async (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const thread = state.threads.find((t) => t.id === threadId)
    if (!thread) return
    const newTitle = window.prompt('Rename chat', thread.title)
    if (newTitle === null || newTitle.trim() === '') return
    try {
      const updated = await renameThread(threadId, newTitle.trim())
      dispatch({ type: 'UPSERT_THREAD', payload: updated } as AppAction)
    } catch (err) {
      console.error('Failed to rename thread:', normalizeError(err, 'Failed to rename chat.').message)
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault()
        handleNewChat()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const width = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH

  return (
    <Drawer
      variant="permanent"
      sx={{
        width,
        flexShrink: 0,
        whiteSpace: 'nowrap',
        transition: (t) => t.transitions.create('width', { duration: t.transitions.duration.shortest }),
        '& .MuiDrawer-paper': {
          width,
          boxSizing: 'border-box',
          overflowX: 'hidden',
          transition: (t) => t.transitions.create('width', { duration: t.transitions.duration.shortest }),
          borderRight: '1px solid',
          borderColor: 'divider',
          backgroundImage: 'none',
        },
      }}
    >
      <Toolbar
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          px: 2,
          gap: 1,
        }}
      >
        {!collapsed && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ overflow: 'hidden' }}>
            <AutoAwesomeIcon color="secondary" fontSize="small" />
            <Typography variant="subtitle1" fontWeight={700} noWrap>
              Orion
            </Typography>
          </Stack>
        )}
        <IconButton size="small" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
        </IconButton>
      </Toolbar>

      <Box sx={{ px: collapsed ? 1 : 2, pb: 1.5 }}>
        <Tooltip title="New chat  (Ctrl+I)" placement="right" disableHoverListener={!collapsed}>
          <Button
            fullWidth
            variant="contained"
            disableElevation
            onClick={handleNewChat}
            startIcon={!collapsed ? <AddIcon /> : undefined}
            sx={{ minWidth: 0, px: collapsed ? 0 : 2 }}
            aria-label="New chat"
          >
            {collapsed ? <AddIcon fontSize="small" /> : 'New chat'}
          </Button>
        </Tooltip>
      </Box>

      <Divider />

      {!collapsed && (
        <Typography
          variant="caption"
          sx={{ px: 2, pt: 1.5, pb: 0.5, color: 'text.secondary', fontWeight: 600, letterSpacing: '0.06em' }}
        >
          RECENT CHATS
        </Typography>
      )}

      <List sx={{ overflowY: 'auto', flex: 1, px: collapsed ? 0.5 : 1, py: 0.5 }} dense>
        {state.threads.length === 0 && !collapsed && (
          <Typography variant="body2" sx={{ px: 1.5, py: 1, color: 'text.secondary' }}>
            No chats yet
          </Typography>
        )}
        {state.threads.map((thread) => (
          <ListItem
            key={thread.id}
            disablePadding
            secondaryAction={
              !collapsed ? (
                <Stack direction="row" spacing={0.25} className="thread-hover-actions" sx={{ opacity: 0 }}>
                  <IconButton edge="end" size="small" onClick={(e) => handleEditThread(thread.id, e)} aria-label="Rename chat">
                    <EditOutlinedIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                  <IconButton edge="end" size="small" onClick={(e) => handleDeleteThread(thread.id, e)} aria-label="Delete chat">
                    <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                </Stack>
              ) : undefined
            }
            sx={{
              mb: 0.5,
              '&:hover .thread-hover-actions': { opacity: 1 },
            }}
          >
            <Tooltip title={collapsed ? thread.title : ''} placement="right">
              <ListItemButton
                selected={state.activeThreadId === thread.id}
                onClick={() => handleSelectThread(thread.id)}
                sx={{ borderRadius: 2, justifyContent: collapsed ? 'center' : 'flex-start', pr: collapsed ? 1 : 7 }}
              >
                {collapsed ? (
                  <ChatBubbleOutlineIcon fontSize="small" />
                ) : (
                  <ListItemText primary={thread.title} primaryTypographyProps={{ noWrap: true, fontSize: 14 }} />
                )}
              </ListItemButton>
            </Tooltip>
          </ListItem>
        ))}
      </List>

      <Divider />
      <Box
        sx={{
          p: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
        }}
      >
        {!collapsed && (
          <Typography variant="caption" color="text.secondary">
            {mode === 'dark' ? 'Dark mode' : 'Light mode'}
          </Typography>
        )}
        <IconButton size="small" onClick={toggleMode} aria-label="Toggle color mode">
          {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
        </IconButton>
      </Box>
    </Drawer>
  )
}
