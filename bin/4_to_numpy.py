import numpy as np

print('load vectors')
data = np.loadtxt('../data/all_users_normalized.tsv')

print(data.shape)

print('save npy')
np.save('../data/all_users_normalized.npy', data)
